"""Measure how MuJoCo's own renderer lights the microwave scene's table top, the
model libero-scene.js reproduces: specular joins the lit colour before the
texture modulates it, so a saturated textured surface shows exactly its texel,
and each light's share follows its spot cone. Prints the mean table colour per
case next to the texture's mean."""
import numpy as np, mujoco
from common import CAMERAS, make

task, env, obs = make(33, cameras=True)
m, d = env.sim.model._model, env.sim.data._data
renderer = mujoco.Renderer(m, 384, 384)
option = mujoco.MjvOption()
option.geomgroup[0] = 0
table = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, "table")
top = next(g for g in range(m.ngeom) if m.geom_bodyid[g] == table and m.geom_type[g] == mujoco.mjtGeom.mjGEOM_BOX
           and m.geom_group[g] != 0)
material = int(m.geom_matid[top])
texture = int(m.mat_texid[material][mujoco.mjtTextureRole.mjTEXROLE_RGB])
w, h, c = int(m.tex_width[texture]), int(m.tex_height[texture]), int(m.tex_nchannel[texture])
texels = np.asarray(m.tex_data[m.tex_adr[texture]:m.tex_adr[texture] + w * h * c]).reshape(-1, c)[:, :3]
print("texture mean".ljust(30), texels.mean(0).round(1))


def shot(label):
    renderer.update_scene(d, camera=CAMERAS["external"], scene_option=option)
    print(label.ljust(30), renderer.render()[300:380, 10:300].reshape(-1, 3).mean(0).round(1))


shot("as exported")
m.geom_rgba[top] = m.mat_rgba[material] = [0.3, 0.3, 0.3, 1]
m.mat_specular[material] = 0
shot("rgba 0.3, specular 0")
m.mat_specular[material], m.mat_shininess[material] = 1, 0
shot("rgba 0.3, specular 1, shine 0")
m.mat_shininess[material] = 0.5
shot("rgba 0.3, specular 1, shine .5")
m.mat_specular[material], m.mat_shininess[material] = 0, 0
active = m.light_active.copy()
m.vis.headlight.active = 0
for k in range(m.nlight):
    m.light_active[:] = 0
    m.light_active[k] = 1
    shot(f"rgba 0.3, only light {k}")
m.light_active[:] = 0
m.vis.headlight.active = 1
shot("rgba 0.3, headlight only")
m.light_active[:] = active
env.close()
