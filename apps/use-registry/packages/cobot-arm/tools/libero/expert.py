"""Privileged waypoint expert on the reference simulator: proves each task is solvable
with the protocol's action limits and records the action sequence for parity checks."""
import json, os
import numpy as np
import mujoco
from common import EXPERT, TASKS, make, goal_joints

LIMIT = 0.5


def waypoints(task_id, m, d):
    if task_id == 0:
        return [("close", None), ("move", [0.0, 0.0, 1.178]), ("move", [0.0, 0.0, 1.115]),
                ("move", [0.0, -0.25, 1.115]), ("move", [0.0, -0.10, 1.178])]
    hinge = np.array([-0.182, 0.269])
    j = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, "microwave_1_microjoint")
    q0 = d.qpos[m.jnt_qposadr[j]]
    r, side, z = 0.2, 0.05, 1.0

    def contact(q):
        a = q - q0
        c, s = np.cos(a), np.sin(a)
        local = np.array([-side, -r])
        return (hinge + np.array([c * local[0] - s * local[1], s * local[0] + c * local[1]])).tolist()

    start = contact(q0)
    path = [("close", None), ("move", [start[0], start[1], 1.185]), ("move", [start[0], start[1], z])]
    for q in np.linspace(q0, 0.15, 24)[1:]:
        p = contact(q)
        path.append(("move", [p[0], p[1], z]))
    return path


def run(task_id):
    task, env, obs = make(task_id)
    m, d = env.sim.model._model, env.sim.data._data
    goal = goal_joints(env, task_id)
    actions, success_step = [], None
    gripper = -1.0
    for kind, target in waypoints(task_id, m, d):
        if kind == "close":
            gripper = 1.0
            for _ in range(10):
                a = [0, 0, 0, 0, 0, 0, gripper]
                obs, _, _, _ = env.step(np.array(a, dtype=float))
                actions.append(a)
            continue
        for _ in range(60):
            err = np.array(target) - obs["robot0_eef_pos"]
            if np.abs(err).max() < 0.005:
                break
            a = np.clip(err / 0.05, -LIMIT, LIMIT).tolist() + [0, 0, 0, gripper]
            obs, _, _, _ = env.step(np.array(a, dtype=float))
            actions.append(a)
            if success_step is None and env.check_success():
                success_step = len(actions)
    qpos = [float(d.qpos[m.jnt_qposadr[mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, g["joint"])]]) for g in goal]
    print(TASKS[task_id], "steps", len(actions), "success_step", success_step, "final success", env.check_success(),
          "goal qpos", np.round(qpos, 4), "eef", obs["robot0_eef_pos"].round(3))
    env.close()
    return {"task_id": task_id, "actions": actions, "success_step": success_step}


if __name__ == "__main__":
    out = [run(t) for t in TASKS]
    os.makedirs(os.path.dirname(EXPERT), exist_ok=True)
    json.dump(out, open(EXPERT, "w"))
