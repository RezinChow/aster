use super::*;
use a3s_code_core::durable_memory_vec::management::MemoryManagementRequest;

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    workspace_root: PathBuf,
    request: MemoryManagementRequest,
}

impl A3sCodeAgent {
    pub(super) async fn handle_memory_management(
        &self,
        args: &acp::ExtRequest,
    ) -> acp::Result<acp::ExtResponse> {
        let invalid = |message: String| acp::Error::invalid_params().data(message);
        if args.params.get().len() > 20 * 1024 {
            return Err(invalid("memory request exceeds its envelope".into()));
        }
        let request: Request =
            serde_json::from_str(args.params.get()).map_err(|error| invalid(error.to_string()))?;
        request
            .request
            .validate()
            .map_err(|error| invalid(error.to_string()))?;
        let workspace = self
            .launch
            .workspace
            .canonicalize()
            .map_err(|_| acp::Error::resource_not_found(None))?;
        if request.workspace_root != workspace {
            return Err(acp::Error::resource_not_found(None));
        }
        let store = Arc::clone(&self.managed_memory);
        let runtime = tokio::runtime::Handle::current();
        let result =
            tokio::task::spawn_blocking(move || runtime.block_on(store.manage(request.request)))
                .await
                .map_err(|error| acp::Error::internal_error().data(error.to_string()))?;
        let body = serde_json::json!({ "workspace_root": workspace, "memory_directory": session_memory_dir(&workspace, &self.launch.config), "outcome": result });
        let raw = serde_json::value::to_raw_value(&body)
            .map_err(|error| acp::Error::internal_error().data(error.to_string()))?;
        Ok(acp::ExtResponse::new(raw.into()))
    }
}

#[cfg(test)]
#[path = "memory_management_tests.rs"]
mod tests;
