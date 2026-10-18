"""Numpy port of robosuite 1.4.1 OSC_POSE + PandaGripper as LIBERO drives it, on a bare MjModel."""
import math
import numpy as np
import mujoco


def axisangle2mat(vec):
    angle = float(np.linalg.norm(vec))
    if math.isclose(angle, 0.0):
        return np.eye(3)
    axis = vec / angle
    s, c = math.sin(angle / 2), math.cos(angle / 2)
    q = np.array([c, *(axis * s)])
    mat = np.zeros(9)
    mujoco.mju_quat2Mat(mat, q)
    return mat.reshape(3, 3)


def orientation_error(desired, current):
    return 0.5 * sum(np.cross(current[:, i], desired[:, i]) for i in range(3))


class Osc:
    def __init__(self, m, d, c):
        self.m, self.d, self.c = m, d, c
        self.site = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_SITE, c["eef_site"])
        self.qi = np.array(c["qpos_index"])
        self.vi = np.array(c["qvel_index"])
        self.arm = np.array(c["arm_actuators"])
        self.grip = np.array(c["gripper_actuators"])
        self.kp, self.kd = np.array(c["kp"]), np.array(c["kd"])
        self.in_min, self.in_max = np.array(c["input_min"]), np.array(c["input_max"])
        self.out_min, self.out_max = np.array(c["output_min"]), np.array(c["output_max"])
        self.low, self.high = np.array(c["torque_low"]), np.array(c["torque_high"])
        self.goal_pos = np.array(c["goal_pos"])
        self.goal_ori = np.array(c["goal_ori"])
        self.initial_joint = np.array(c["initial_joint"])
        self.grip_action = np.array(c["gripper_action"])
        self.grip_speed = c["gripper_speed"]
        self.grip_range = np.array(c["gripper_ctrlrange"])
        self.null_kp = c["nullspace_kp"]
        self.substeps = c["substeps"]
        self.full_m = np.zeros((m.nv, m.nv))

    def update(self):
        m, d = self.m, self.d
        mujoco.mj_forward(m, d)
        self.ee_pos = d.site_xpos[self.site].copy()
        self.ee_ori = d.site_xmat[self.site].reshape(3, 3).copy()
        jacp, jacr = np.zeros((3, m.nv)), np.zeros((3, m.nv))
        mujoco.mj_jacSite(m, d, jacp, jacr, self.site)
        self.ee_vel_p, self.ee_vel_r = jacp @ d.qvel, jacr @ d.qvel
        self.q, self.qd = d.qpos[self.qi].copy(), d.qvel[self.vi].copy()
        self.J_pos, self.J_ori = jacp[:, self.vi], jacr[:, self.vi]
        mujoco.mj_fullM(m, self.full_m, d.qM)
        self.M = self.full_m[np.ix_(self.vi, self.vi)]

    def set_goal(self, action):
        a = np.clip(action, self.in_min, self.in_max)
        scale = np.abs(self.out_max - self.out_min) / np.abs(self.in_max - self.in_min)
        delta = (a - (self.in_max + self.in_min) / 2) * scale + (self.out_max + self.out_min) / 2
        if any(not math.isclose(x, 0.0) for x in delta[3:]):
            self.goal_ori = axisangle2mat(delta[3:]) @ self.ee_ori
        self.goal_pos = self.ee_pos + delta[:3]

    def torques(self):
        force = self.kp[:3] * (self.goal_pos - self.ee_pos) - self.kd[:3] * self.ee_vel_p
        torque = self.kp[3:] * orientation_error(self.goal_ori, self.ee_ori) - self.kd[3:] * self.ee_vel_r
        J = np.vstack([self.J_pos, self.J_ori])
        Minv = np.linalg.inv(self.M)
        lam_full = np.linalg.pinv(J @ Minv @ J.T)
        lam_pos = np.linalg.pinv(self.J_pos @ Minv @ self.J_pos.T)
        lam_ori = np.linalg.pinv(self.J_ori @ Minv @ self.J_ori.T)
        Jbar = Minv @ J.T @ lam_full
        N = np.eye(len(self.vi)) - Jbar @ J
        tau = J.T @ np.concatenate([lam_pos @ force, lam_ori @ torque]) + self.d.qfrc_bias[self.vi]
        kv = 2 * math.sqrt(self.null_kp)
        tau += N.T @ (self.M @ (self.null_kp * (self.initial_joint - self.q) - kv * self.qd))
        return np.clip(tau, self.low, self.high)

    def step(self, action):
        action = np.asarray(action, dtype=float)
        for i in range(self.substeps):
            mujoco.mj_forward(self.m, self.d)
            self.update()
            if i == 0:
                self.set_goal(action[:6])
            tau = self.torques()
            self.grip_action = np.clip(self.grip_action + np.array([-1.0, 1.0]) * self.grip_speed * np.sign(action[6:]),
                                       -1.0, 1.0)
            lo, hi = self.grip_range[:, 0], self.grip_range[:, 1]
            self.d.ctrl[self.grip] = 0.5 * (hi + lo) + 0.5 * (hi - lo) * self.grip_action
            self.d.ctrl[self.arm] = tau
            mujoco.mj_step(self.m, self.d)


def load(physics_xml, episode):
    m = mujoco.MjModel.from_xml_string(physics_xml)
    d = mujoco.MjData(m)
    s = episode["state"]
    d.time = s["time"]
    d.qpos[:], d.qvel[:], d.ctrl[:] = s["qpos"], s["qvel"], s["ctrl"]
    if m.na:
        d.act[:] = s["act"]
    d.qacc_warmstart[:] = s["qacc_warmstart"]
    return m, d


def success(m, d, joints):
    for j in joints:
        jid = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, j["joint"])
        if not d.qpos[m.jnt_qposadr[jid]] > j["closed_above"]:
            return False
    return True
