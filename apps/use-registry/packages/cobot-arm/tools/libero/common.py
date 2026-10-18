"""Shared setup for the LIBERO export: the two libero_90 tasks, their cameras, and a
robosuite environment settled on one of the task's first INITS init states.

Needs a LIBERO checkout at the revision in export.py (LIBERO_SRC) with its config
file (LIBERO_CONFIG_PATH), robosuite 1.4.1 and MuJoCo 3.5.0. Order:

    python expert.py && python export.py && python validate.py && python pack.py
    node js-parity.mjs

Intermediate output goes to LIBERO_EXPORT_OUT (default: <tmp>/libero-export).
"""
import os, sys, tempfile

for key in ("LIBERO_SRC", "LIBERO_CONFIG_PATH"):
    if not os.environ.get(key):
        sys.exit(f"{key} is not set; see the docstring of tools/libero/common.py")
os.environ.setdefault("MUJOCO_GL", "cgl")
sys.path.insert(0, os.environ["LIBERO_SRC"])
import numpy as np
from libero.libero import benchmark
from libero.libero.envs.env_wrapper import ControlEnv

OUT = os.environ.get("LIBERO_EXPORT_OUT") or os.path.join(tempfile.gettempdir(), "libero-export")
PACKAGE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXPERT = os.path.join(OUT, "expert.json")
TASKS = {0: "drawer", 33: "microwave"}
CAMERAS = {"external": "agentview", "wrist": "robot0_eye_in_hand"}
SUITE = benchmark.get_benchmark_dict()["libero_90"](task_order_index=0)
# The batch report of 2 planners x 2 tasks x INITS episodes must fit the 64 KiB view state.
INITS = 10


def make(task_id, cameras=False, size=384, init_index=0):
    task = SUITE.get_task(task_id)
    states = SUITE.get_task_init_states(task_id)
    kwargs = dict(bddl_file_name=SUITE.get_task_bddl_file_path(task_id), controller="OSC_POSE",
                  control_freq=20, horizon=2000, initialization_noise=None)
    if cameras:
        kwargs.update(use_camera_obs=True, has_offscreen_renderer=True, camera_depths=True,
                      camera_names=list(CAMERAS.values()), camera_heights=size, camera_widths=size)
    else:
        kwargs.update(use_camera_obs=False, has_offscreen_renderer=False)
    env = ControlEnv(**kwargs)
    env.seed(0)
    env.reset()
    env.set_init_state(np.asarray(states[init_index], dtype=np.float64))
    obs = None
    for _ in range(10):
        obs, _, _, _ = env.step(np.array([0., 0., 0., 0., 0., 0., -1.]))
    return task, env, obs


def goal_joints(env, task_id):
    """The joints and thresholds LIBERO's Close predicate reads for this task."""
    inner = env.env
    goal = inner.parsed_problem["goal_state"]
    out = []
    for state in goal:
        assert state[0].lower() == "close", state
        name = state[1]
        if name in inner.object_sites_dict:
            joints = inner.object_sites_dict[name].joints
            parent = inner.get_object(inner.object_states_dict[name].parent_name)
        else:
            joints = inner.get_object(name).joints
            parent = inner.get_object(name)
        close = parent.object_properties["articulation"]["default_close_ranges"]
        for joint in joints:
            out.append({"object": name, "joint": joint, "closed_above": float(min(close))})
    return out
