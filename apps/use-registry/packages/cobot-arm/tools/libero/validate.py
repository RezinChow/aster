"""Replay the expert in robosuite and, in lockstep, with the numpy OSC port on (a) the full robosuite
model and (b) the exported physics.xml, from each exported init state. Reports per-step divergence
and the success step of each. The expert was recorded on init state 0; on the others it is only a
fixed action sequence, so success there is not expected."""
import json, os, sys
import numpy as np
import mujoco
from common import OUT, TASKS, make
from osc import Osc, load, success


def run(task_id, init):
    folder = os.path.join(OUT, TASKS[task_id])
    episode = json.load(open(os.path.join(folder, "episode.json")))
    phys = open(os.path.join(folder, "physics.xml")).read()
    settled = episode["inits"][init]
    task, env, obs = make(task_id, init_index=init)
    m0, d0 = env.sim.model._model, env.sim.data._data
    c = {**episode["controller"], **{k: settled[k] for k in ("goal_pos", "goal_ori", "initial_joint", "gripper_action")}}
    site0 = mujoco.mj_name2id(m0, mujoco.mjtObj.mjOBJ_SITE, c["eef_site"])

    full_d = mujoco.MjData(m0)
    mujoco.mj_copyData(full_d, m0, d0)
    full = Osc(m0, full_d, c)
    pm, pd = load(phys, settled)
    port = Osc(pm, pd, c)
    site_p = mujoco.mj_name2id(pm, mujoco.mjtObj.mjOBJ_SITE, c["eef_site"])
    joints = episode["success"]["joints"]

    worst = {"full_eef": 0.0, "export_eef": 0.0, "full_qpos": 0.0, "export_qpos": 0.0}
    first = {"robosuite": None, "full": None, "export": None}
    actions = episode["reference"]["actions"]
    for k, a in enumerate(actions):
        env.step(np.array(a, dtype=float))
        full.step(a)
        port.step(a)
        ref_eef = d0.site_xpos[site0]
        worst["full_eef"] = max(worst["full_eef"], float(np.abs(full_d.site_xpos[site0] - ref_eef).max()))
        worst["export_eef"] = max(worst["export_eef"], float(np.abs(pd.site_xpos[site_p] - ref_eef).max()))
        worst["full_qpos"] = max(worst["full_qpos"], float(np.abs(full_d.qpos - d0.qpos).max()))
        worst["export_qpos"] = max(worst["export_qpos"], float(np.abs(pd.qpos - d0.qpos).max()))
        for key, ok in (("robosuite", env.check_success()), ("full", success(m0, full_d, joints)),
                        ("export", success(pm, pd, joints))):
            if ok and first[key] is None:
                first[key] = k + 1
    env.close()
    return {"task": TASKS[task_id], "init": init, "steps": len(actions), "worst": worst, "success_step": first,
            "hull_max_deviation_m": settled["physics_check"]["hull_max_deviation_m"]}


if __name__ == "__main__":
    ids = [int(x) for x in sys.argv[1:]] or list(TASKS)
    for t in ids:
        count = len(json.load(open(os.path.join(OUT, TASKS[t], "episode.json")))["inits"])
        for init in range(count):
            print(json.dumps(run(t, init)), flush=True)
