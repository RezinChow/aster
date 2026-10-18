#![cfg(test)]

use super::*;
use crate::flow_graph::{run_object_id, step_object_id};
use crate::state_graph::GraphRuntime;

#[tokio::test]
async fn cancelled_batch_step_stays_cancelled_in_live_and_replayed_projections() {
    let run_id = "cancelled-batch";
    let events = vec![
        FlowEvent::RunCreated {
            spec: WorkflowSpec::rust_embedded("batch", "1", "ptc", "run"),
            input: json!({}),
        },
        FlowEvent::RunStarted,
        FlowEvent::StepCreated {
            step_id: "peer".into(),
            step_name: "read".into(),
            input: json!({"path": "README.md"}),
            retry: Default::default(),
        },
        FlowEvent::StepStarted {
            step_id: "peer".into(),
            attempt: 1,
        },
        FlowEvent::StepCancelled {
            step_id: "peer".into(),
            attempt: 1,
            reason: "batch sibling failed; external outcome unknown".into(),
        },
        FlowEvent::RunFailed {
            error: "batch sibling failed".into(),
        },
    ];
    let history: Vec<_> = events
        .into_iter()
        .enumerate()
        .map(|(index, event)| {
            FlowEventEnvelope::new(
                run_id,
                index as u64 + 1,
                uuid::Uuid::new_v4(),
                Utc::now(),
                event,
            )
        })
        .collect();
    let graph = Arc::new(Mutex::new(GraphRuntime::new()));
    let graph_observer = FlowGraphObserver::new(Arc::clone(&graph));
    let (tx, mut rx) = broadcast::channel(32);
    let observer =
        AgentEventFlowObserver::new(tx, "session".into(), dynamic_workflow_execution_plan(&[]));
    for envelope in &history {
        graph_observer.project(envelope.clone()).await.unwrap();
        observer.observe(envelope.clone()).await;
    }

    let plan = dynamic_workflow_execution_plan(&history);
    let state = observer.state.lock().await;
    let graph = graph.lock().await;
    assert_eq!(
        (
            plan.steps[0].status,
            state.plan.steps[0].status,
            graph
                .graph()
                .object(&step_object_id(run_id, "peer"))
                .unwrap()
                .data["status"]
                .clone(),
        ),
        (
            TaskStatus::Cancelled,
            TaskStatus::Cancelled,
            json!("cancelled")
        ),
    );
    assert_eq!(
        graph.graph().object(&run_object_id(run_id)).unwrap().data["status"],
        "failed"
    );
    assert!(
        std::iter::from_fn(|| rx.try_recv().ok()).any(|event| matches!(
            event,
            AgentEvent::StepEnd { step_id, status: TaskStatus::Cancelled, .. } if step_id == "peer"
        ))
    );
}
