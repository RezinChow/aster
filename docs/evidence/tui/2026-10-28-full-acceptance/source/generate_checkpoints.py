"""Reconcile the 153 source checkpoints with retained successful live observations."""
import hashlib
import json
from pathlib import Path
import re

CAMPAIGN = Path(__file__).resolve().parent.parent
rows = []
for line in (CAMPAIGN / 'OUTCOME.md').read_text(encoding='utf-8').splitlines():
    match = re.fullmatch(r'\| (F\d{2}\.\d{2}) \| (.+) \|', line)
    if match:
        rows.append({'id': match[1], 'requirement': match[2], 'status': 'pending', 'observations': [], 'remaining': '尚未建立本检查点全部条件的双平台端到端证据。'})
assert len(rows) == 153 and len({row['id'] for row in rows}) == 153
assert len({row['id'].split('.')[0] for row in rows}) == 16
by_id = {row['id']: row for row in rows}
cache = {}

def evidence(platform, phase, case):
    relative = f'{platform}/{phase}/{case}.json'
    if relative not in cache:
        raw = (CAMPAIGN / relative).read_bytes()
        data = json.loads(raw)
        assert data['assertions_finished'] and not data['panicked'], relative
        assert data['config_unchanged'] and data['model'] == 'kimi/k3.1-pro', relative
        pair = next(item['detail'] for item in data['oracles'] if item['name'] == 'source-pair')
        cache[relative] = {'platform': platform, 'file': relative, 'sha256': hashlib.sha256(raw).hexdigest(), 'source_pair': pair, 'oracle_count': len(data['oracles']), 'named_oracles': [item['name'] for item in data['oracles'] if 'name' in item], 'metadata_record_count': sum('name' not in item for item in data['oracles'])}
    return cache[relative]

def put(point, status, cases, remaining='', phase='full-31-current-pair'):
    row = by_id[point]
    row['status'] = status
    row['remaining'] = remaining
    row['observations'] = [evidence(platform, phase, case) for platform in ('windows', 'linux') for case in cases]

put('F01.01', 'partial', ['missing-file', 'read'], '默认 Normal 和指定模型已验证；启动异常属于后续独立检查点。')
put('F01.02', 'partial', ['plan-read-write', 'plan-yolo-ceiling'], '显式 --plan 启动、真实 read、write 拒绝及 YOLO 上限已验证；有写副作用 exec 仍待独立 live 验证。')
put('F01.03', 'verified_for_listed_contract', ['read'])
put('F01.07', 'partial', ['interrupt', 'surface'], '正常退出和运行中取消已验证；启动中取消及异常退出后的终端模式仍待验证。')
put('F02.03', 'partial', ['learned-approval'], '权限学习的工作区隔离已验证；信任记录的拒绝、取消和隔离仍待验证。')
put('F02.04', 'partial', ['multiline-unicode'], '实际中文/空格文件与相对工具路径已验证；相对 --cwd 和其他平台路径形式仍待验证。')
put('F03.01', 'verified_for_listed_contract', ['multiline-unicode', 'long-unicode-paste'])
put('F03.02', 'partial', ['multiline-unicode'], '多行字节和替代提交已验证；手工逐键插入换行仍待验证。')
put('F03.03', 'verified_for_listed_contract', ['long-unicode-paste'])
put('F03.04', 'partial', ['draft-edit-controls'], '光标、词/行删除已验证；选区编辑仍待验证。', phase='full-31-current-pair')
put('F03.05', 'partial', ['draft-edit-controls'], 'Unicode 单行的撤销、重做、清空、暂存已验证；多行组合仍待验证。', phase='full-31-current-pair')
put('F03.06', 'partial', ['multiline-unicode'], '已验证实际回填；历史回填后的编辑和再次提交仍待验证。')
for point in ('F03.07', 'F03.08'):
    row = by_id[point]
    row['status'] = 'verified_for_listed_contract' if point == 'F03.07' else 'partial'
    row['remaining'] = '' if point == 'F03.07' else '保存、非零退出、非法 UTF-8、程序不存在已验证；正常关闭而不保存的取消路径仍待验证。'
    row['observations'] = [evidence(platform, 'full-31-current-pair', 'editor-' + case) for platform in ('windows', 'linux') for case in ('save', 'nonzero', 'invalid-utf8', 'missing-program')]
put('F04.01', 'partial', ['preferences-restart', 'surface'], '独立会话 ID 已验证；全部历史/权限/运行状态的互不污染仍待验证。')
put('F04.02', 'partial', ['surface'], '返回欢迎页已验证；取消和返回已有会话仍待验证。')
put('F04.03', 'partial', ['surface', 'read'], 'ID 和模型已核对；所有数值字段与后端状态的逐项比对仍待验证。')
put('F04.04', 'verified_for_listed_contract', ['resume-model-history'])
put('F04.05', 'partial', ['resume-model-history'], '实际历史恢复已验证；同一 home 内多个工作区/多会话的最近项选择仍待验证。')
put('F04.08', 'partial', ['surface'], '确认删除及磁盘结果已验证；取消删除与其他会话不受影响仍待验证。')
for point in ('F05.01', 'F05.02', 'F05.03'):
    put(point, 'partial', ['surface'], '目录、选择恢复和 effort footer 已验证；真实换模推理与 effort transport/预算仍待逐项验证。')
for point in ('F05.04', 'F05.05', 'F05.06', 'F05.07', 'F05.08', 'F05.09', 'F05.10'):
    put(point, 'partial', ['config-crud-restart'], 'CRUD、取消、reload、保存、重启及后续 Kimi 请求已验证；完整字段边界和实际请求参数仍待逐项验证。')
put('F05.11', 'partial', ['surface'], '实际轮次后上下文面板已验证；used/total/free 数值仍待独立核对。')
put('F05.12', 'partial', ['compact-model-history'], '有/无 focus 的真实压缩及后续无工具回忆已验证；失败恢复仍待验证。')
put('F06.01', 'partial', ['read', 'coding'], '真实流式请求与最终响应已验证；完整 delta/最终正文逐项对应仍待验证。')
put('F06.02', 'partial', ['write-verify', 'expand'], '真实工具卡与结果已验证；全部调用的 UI 卡片计数和更新归属仍待验证。')
put('F06.07', 'partial', ['interrupt'], '运行中 shell 取消及八秒内无晚到写入已验证；单独取消模型流仍待验证。')
put('F06.08', 'partial', ['yolo-explicit-deny', 'missing-file'], '拒绝后的同会话继续可用已验证；provider/ACP 故障后的重连和幂等恢复仍待验证。')
put('F07.01', 'partial', ['read', 'missing-file', 'plan-read-write'], '真实读、缺失和 EOF 字节已验证；范围/分页/越界的完整 live 组合仍待验证。')
put('F07.04', 'partial', ['write-verify', 'plan-read-write'], '实际写入与无尾换行精确字节已验证；Unicode、CRLF、覆盖及失败原子性仍待完整验证。')
put('F07.05', 'partial', ['coding'], '真实多轮修改与独立 checker 已验证；多重匹配和未匹配仍待验证。')
put('F07.07', 'partial', ['write-verify', 'coding', 'learned-approval'], '原生 shell 成功与真实输出已验证；非零退出、stderr 和全部引用形式仍待验证。')
put('F07.08', 'partial', ['interrupt'], '运行中取消已验证；超时和输出截断仍待独立验证。')
put('F07.18', 'partial', ['expand', 'write-verify'], '真实工具输出与展开尾部已验证；全部 diff/raw/card 形式仍待验证。')
put('F07.19', 'verified_for_listed_contract', ['coding'])
put('F08.01', 'partial', ['allow-once', 'permission-reject', 'write-verify'], 'Normal 与 YOLO 已验证；Auto 是明确禁用入口，不作为可用功能计数。')
put('F08.02', 'partial', ['allow-once'], '实际 Allow once 已验证；相同工具下一次未经授权调用仍待单独验证。')
put('F08.03', 'verified_for_listed_contract', ['learned-approval'])
put('F08.04', 'verified_for_listed_contract', ['learned-approval'])
put('F08.05', 'partial', ['permission-reject', 'permission-cancel'], '两种 UI 操作无写入已验证；真实拒绝与取消结果的独立归属仍待验证。')
put('F08.06', 'verified_for_listed_contract', ['yolo-explicit-deny', 'write-verify'])
put('F08.07', 'partial', ['yolo-explicit-deny'], '实际 CLI deny 跨 YOLO 仍有效；全部重开/换模组合仍待 live 验证。')
put('F08.08', 'partial', ['plan-yolo-ceiling'], 'Plan+YOLO 的写入拒绝已验证；学习规则和有写副作用 exec 组合仍待验证。')
put('F08.11', 'partial', ['learned-approval'], '实际 ACL 学习和路径规则已验证；全部参数/路径形式仍待 live 验证。')
put('F09.01', 'partial', ['plan-read-write', 'plan-yolo-ceiling'], 'Plan 的 read 和 write 上限已验证；search 与有写副作用 exec 仍待验证。')
put('F09.06', 'partial', ['plan-read-write', 'plan-yolo-ceiling'], '真实模式切换和权限上限已验证；计划审批的完整入口组合仍待验证。')
put('F10.01', 'verified_for_listed_contract', ['goal'])
for point in ('F10.02', 'F10.04', 'F10.05'):
    put(point, 'partial', ['goal', 'surface'], '目标控制 durable facts 已验证；停止后续工作、预算累计、跨会话和完整状态仍待验证。')
for point in ('F11.02', 'F11.03', 'F11.04', 'F11.05'):
    put(point, 'partial', ['form-submit', 'form-cancel'], '真实原生表单的代表性字段、校验、提交和取消已验证；全部组件、约束和焦点组合仍待验证。')
for point in ('F12.01', 'F12.02'):
    put(point, 'verified_for_listed_contract', ['reading-navigation'], phase='full-31-current-pair')
put('F12.03', 'partial', ['reading-navigation'], '实际 turn 选择和取消恢复已验证；当前 jump picker 无筛选输入，不能宣称已验证筛选。', phase='full-31-current-pair')
put('F12.04', 'partial', ['reading-navigation'], '实际顶部/底部已验证；行、半页、整页和轮次/响应组合仍待验证。', phase='full-31-current-pair')
put('F12.05', 'partial', ['expand'], '真实工具展开尾部已验证；单块/全部/思考的独立折叠控制仍待验证。')
for point in ('F13.01', 'F13.03', 'F13.05', 'F13.07', 'F13.09', 'F13.10'):
    put(point, 'partial', ['preferences-restart', 'surface'], '对应代表性设置、模式或入口有实际证据；本检查点的全部控件/渲染/焦点组合仍待验证。')
put('F13.06', 'partial', ['reading-navigation'], '真实 Vim 顶部/底部导航已验证；选择、折叠、搜索及编辑组合仍待验证。', phase='full-31-current-pair')
put('F13.08', 'partial', ['reading-navigation'], '三种 PTY 尺寸下正文位置可达已验证；所有 modal/必填/确认控件仍待验证。', phase='full-31-current-pair')
for point in ('F14.01', 'F14.02', 'F14.03', 'F14.07'):
    put(point, 'partial', ['copy-export-contract'], '指定响应精确文件字节、导出顺序和部分失败已验证；系统 clipboard、恢复及全部编码/边界仍待验证。')
put('F16.01', 'verified_for_listed_contract', ['backend-refusal'])
for point in ('F16.03', 'F16.04'):
    put(point, 'partial', ['paste-help-capability', 'history-help-capability', 'sessions-help-capability'], '三个实际帮助详情已修复并验证；全部快捷键/面板/CLI 的一致性仍待复核。', phase='full-31-current-pair')
put('F16.05', 'partial', ['surface'], 'doctor 实际入口已运行；每项诊断和缺依赖故障仍待验证。')
put('F16.09', 'partial', ['read', 'copy-export-contract'], '测试隔离和原 ACL 字节不变已逐例核对；新增全部 evidence 的最终凭据精确扫描仍待执行。')

put('F03.10', 'explicitly_unavailable', ['direct-shell-capability'], 'Code 后端明确拒绝直接 shell 协议，不把拒绝计为可用执行功能。', phase='full-31-current-pair')
put('F03.11', 'partial', ['queue-edit-delete-drain'], '运行中排队、编辑和删除已验证；立即插话仍待验证。', phase='full-31-current-pair')
put('F06.04', 'verified_for_listed_contract', ['queue-edit-delete-drain'], phase='full-31-current-pair')
put('F06.05', 'partial', ['queue-edit-delete-drain'], '实际查看、编辑、删除和执行顺序已验证；未提交草稿及其他队列来源组合仍待验证。', phase='full-31-current-pair')

def counterexample(platform, phase, case):
    relative = f'{platform}/{phase}/{case}.json'
    raw = (CAMPAIGN / relative).read_bytes()
    data = json.loads(raw)
    assert data['panicked'] and not data['assertions_finished']
    assert data['config_unchanged'] and data['model'] == 'kimi/k3.1-pro'
    pair = next(item['detail'] for item in data['oracles'] if item.get('name') == 'source-pair')
    return {'platform': platform, 'file': relative, 'sha256': hashlib.sha256(raw).hexdigest(), 'source_pair': pair, 'result': 'reproduced_failure'}

for point, case, windows_phase, linux_phase in [
    ('F06.06', 'send-now-cancel-ownership', 'tool-contracts-send-now-isolated', 'tool-contracts-isolated-send_now_cancels_running_tool_and_runs_new_prompt_once'),
    ('F07.07', 'shell-nonzero-contract', 'tool-contracts-shell-isolated', 'tool-contracts-isolated-native_shell_preserves_nonzero_stdout_stderr_cwd_and_recovers'),
]:
    by_id[point]['counterexamples'] = [counterexample(platform, phase, case) for platform, phase in [('windows', windows_phase), ('linux', linux_phase)]]
by_id['F06.06']['status'] = 'partial'
by_id['F06.06']['remaining'] = '原生工具取消、后续正文逐字保持及未验证副作用的明确拒绝已在两平台验证；纯模型取消仍错误追加完成标记，修复后的同源码完整 live 验证仍在进行。'
for point in ('F03.11', 'F06.06', 'F06.07'):
    by_id[point]['observations'].extend([
        evidence('windows', 'owed-guidance-extended-tools', 'send-now-cancel-ownership'),
        evidence('linux', 'owed-guidance-cancel-early', 'send-now-cancel-ownership'),
    ])
for point in ('F06.06', 'F06.07'):
    by_id[point].setdefault('counterexamples', []).extend([
        counterexample(platform, 'owed-model-cancel-isolated', 'send-now-model-stream')
        for platform in ('windows', 'linux')
    ])
for point in ('F03.11', 'F06.06', 'F06.07'):
    by_id[point]['observations'].extend([
        evidence(platform, 'completion-facts-cancel', case)
        for platform in ('windows', 'linux')
        for case in ('send-now-cancel-ownership', 'send-now-model-stream')
    ])
by_id['F03.11']['remaining'] = '排队、编辑、删除和立即插话的两条独立取消路径均有双平台证据；最终同源码完整批次及全部输入组合仍待验证。'
by_id['F06.06']['remaining'] = '真实工具和模型流取消后，后续消息字节与归属均已双平台验证；历史完成标记错误保留反例，最终同源码完整批次仍待完成。'
by_id['F06.07']['remaining'] = '真实模型部分响应和运行中工具均已取消，后续消息完成或明确拒绝，无晚到写入；最终同源码完整批次及全部子任务组合仍待完成。'
by_id['F07.07']['observations'].append(evidence('windows', 'owed-guidance-extended-tools', 'shell-nonzero-contract'))
by_id['F07.07']['observations'].append(evidence('linux', 'owed-guidance-native-shell', 'shell-nonzero-contract'))
by_id['F07.07']['counterexamples'].append(counterexample('linux', 'owed-guidance-native-shell-isolated', 'shell-nonzero-contract'))
by_id['F07.07']['remaining'] = '已有真实失败脚本的 exit 7、双输出流、原生 cwd、含空格脚本名和继续请求证据；历史模型回答遗漏仍保留反例，最终同源码双平台批次及全部引用形式仍待验证。'
for point, remaining in [
    ('F07.02', '目录优先排序与 limit=2 的真实结果已验证；全部路径、工作区边界和目录条目类型仍待覆盖。'),
    ('F07.03', '真实未知内容、限定目录、上下文、分页 cursor、无匹配及不支持组合的拒绝已验证；位置/全部范围边界仍待覆盖。'),
]:
    by_id[point]['status'] = 'partial'
    by_id[point]['remaining'] = remaining
    by_id[point]['observations'] = [
        evidence('windows', 'owed-guidance-extended-tools', 'ls-search-contracts'),
        evidence('linux', 'owed-guidance-ls-search', 'ls-search-contracts'),
    ]
by_id['F06.06']['status'] = 'verified_for_listed_contract'
by_id['F06.06']['remaining'] = ''
by_id['F06.06']['observations'] = [
    evidence(platform, 'full-35-qualification-final', case)
    for platform in ('windows', 'linux')
    for case in ('send-now-cancel-ownership', 'send-now-model-stream')
]
for point in ('F03.04', 'F03.05'):
    by_id[point].setdefault('counterexamples', []).append(counterexample('linux', 'full-35-qualification-final', 'draft-edit-controls'))
    by_id[point]['observations'].extend([
        evidence('windows', 'full-35-qualification-final', 'draft-edit-controls'),
        evidence('linux', 'draft-edit-32b8-isolated', 'draft-edit-controls'),
    ])
    by_id[point]['remaining'] += ' 最新 Linux 完整批次在 Ctrl+W 后 200 ms 的屏幕断言失败，单独复跑通过；输入与显示同步的稳定性仍待验证。'
for point in ('F16.03', 'F16.04'):
    by_id[point]['observations'].extend([
        evidence(platform, 'full-35-qualification-final', 'send-now-help-capability')
        for platform in ('windows', 'linux')
    ])
for platform, case, points in [
    ('windows', 'ls-search-contracts', ('F07.02', 'F07.03')),
    ('linux', 'yolo-explicit-deny', ('F08.01', 'F08.10')),
    ('linux', 'shell-nonzero-contract', ('F07.07',)),
]:
    for point in points:
        by_id[point].setdefault('counterexamples', []).append(counterexample(platform, 'full-35-ui-tail-readiness', case))
by_id['F07.07']['counterexamples'].append(counterexample('linux', 'shell-43ce-isolated', 'shell-nonzero-contract'))
by_id['F07.07']['remaining'] = '工具回执的 exit 7、双输出及 cwd 有真实证据，但最新 Linux 批次及单独复跑的最终模型答复均遗漏输出；仍须解决回答与实际工具结果不一致及其他引用形式。'
for point in ('F07.02', 'F07.03'):
    by_id[point]['observations'].append(evidence('windows', 'ls-search-43ce-isolated', 'ls-search-contracts'))
    by_id[point]['remaining'] += ' 最新 Windows 批次在 search count 断言失败，同源码单独复跑通过，不能据此声称稳定通过。'
for point in ('F08.01', 'F08.10'):
    by_id[point]['observations'].append(evidence('linux', 'deny-43ce-isolated', 'yolo-explicit-deny'))
    by_id[point]['remaining'] += ' 最新 Linux 批次没有进入 write 工具调用，无法验证拒绝；同源码单独复跑的真实拒绝与后续读取通过。'
for point, remaining in [
    ('F03.04', '原单次按键与精确提交断言保持；可观察屏幕状态替代固定延时后，双平台完整批次及后续独立试跑通过。选区编辑仍待验证。'),
    ('F03.05', 'Unicode 单行撤销、重做、清空及暂存通过；保留原失败和无效的整行 Unicode 显示匹配试验。多行组合仍待验证。'),
]:
    by_id[point]['observations'].extend([
        evidence(platform, phase, 'draft-edit-controls')
        for platform in ('windows', 'linux')
        for phase in ('full-35-ui-tail-readiness', 'startup-errors-pilot')
    ])
    by_id[point]['remaining'] = remaining


def native_evidence(platform, phase, cases):
    relative = f'{platform}/{phase}/report.json'
    raw = (CAMPAIGN / relative).read_bytes()
    data = json.loads(raw)
    assert data['all_passed'] and data['config_unchanged']
    assert data['source_pair'].split(':')[1] == '189982670423c6c055335d5e701b491d295583e5'
    found = {item['case']: item for item in data['cases']}
    for case in cases:
        item = found[case]
        assert item['result'] == 'pass' and not item['timed_out']
        if case == 'scheduler-confirmation-cancel':
            assert item['confirmation_cancelled_before_execution'] and item['no_file_effect']
            assert item['model_requested_tools'] == ['write'] and item['confirmation_answers'] == [False]
    return {'platform': platform, 'file': relative, 'sha256': hashlib.sha256(raw).hexdigest(),
            'source_pair': data['source_pair'], 'script_sha256': data['script_sha256'], 'native_cases': cases}


for point, cases in [
    ('F01.04', ['missing-companion', 'mismatched-companion', 'unexecutable-companion']),
    ('F01.05', ['missing-acl', 'invalid-acl', 'unknown-model']),
]:
    by_id[point]['status'] = 'verified_for_listed_contract'
    by_id[point]['remaining'] = ''
    by_id[point]['observations'] = [native_evidence(platform, 'native-cli-startup-errors', cases) for platform in ('windows', 'linux')]
by_id['F01.06']['status'] = 'verified_for_listed_contract'
by_id['F01.06']['remaining'] = ''
by_id['F01.06']['observations'] = [
    item for platform in ('windows', 'linux') for item in [
        evidence(platform, 'full-35-ui-tail-readiness', 'permission-cancel'),
        native_evidence(platform, 'native-cli-startup-errors', ['headless-json', 'headless-relative-cwd']),
        native_evidence(platform, 'native-cli-confirmation-cancel', ['scheduler-confirmation-cancel']),
    ]
]
by_id['F01.06']['qualification_note'] = '调度器在 confirmation.answered=false 后结束，尚未进入工具准备/执行；原工具回执预期不适用的测试失败和原脚本仍保留，不作为功能失败或成功证据。'
by_id['F02.04']['observations'].extend([
    native_evidence(platform, 'native-cli-startup-errors', ['headless-relative-cwd']) for platform in ('windows', 'linux')
])
by_id['F02.04']['remaining'] = '两平台中文/空格相对 --cwd 的 headless 真实模型请求已修复验证，正确目录产生精确 user.message；交互 TUI 的相对启动及其他平台路径形式仍待验证。'


def native_counterexample(platform, phase, case):
    relative = f'{platform}/{phase}/report.json'
    raw = (CAMPAIGN / relative).read_bytes()
    data = json.loads(raw)
    assert data['config_unchanged'] and not data['all_passed']
    item = next(item for item in data['cases'] if item['case'] == case)
    assert item['result'] == 'fail'
    return {'platform': platform, 'file': relative, 'sha256': hashlib.sha256(raw).hexdigest(),
            'source_pair': data['source_pair'], 'script_sha256': data['script_sha256'], 'native_case': case}


for platform in ('windows', 'linux'):
    by_id['F01.04'].setdefault('counterexamples', []).append(native_counterexample(platform, 'native-cli-unexecutable-initial', 'unexecutable-companion'))
    phase = 'native-cli-invalid-acl' if platform == 'windows' else 'native-cli-invalid-acl-initial'
    by_id['F01.05'].setdefault('counterexamples', []).append(native_counterexample(platform, phase, 'invalid-acl'))
    by_id['F02.04'].setdefault('counterexamples', []).append(native_counterexample(platform, 'native-cli-relative-cwd', 'headless-relative-cwd'))
    by_id['F01.06'].setdefault('excluded_evaluations', []).append(native_counterexample(platform, 'native-cli-non-tty-permission', 'non-tty-permission'))
counts = {status: sum(row['status'] == status for row in rows) for status in sorted({row['status'] for row in rows})}
result = {'schema': 'aster.tui.checkpoints.v1', 'complete': False, 'model': 'kimi/k3.1-pro', 'checkpoint_count': len(rows), 'domain_count': 16, 'claim': '仅所列合同和所链接运行有证据；最新完整 35 项批次为 Windows 34/35、Linux 33/35，反例与独立复跑均保留。新增启动边界单独绑定最终源码，不替代完整批次或 153 项验收。', 'status_counts': counts, 'verified_percent': round(counts.get('verified_for_listed_contract', 0) * 100 / len(rows), 2), 'checkpoints': rows}
(CAMPAIGN / 'CHECKPOINTS.json').write_bytes((json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
reopened = json.loads((CAMPAIGN / 'CHECKPOINTS.json').read_text(encoding='utf-8'))
assert [row['id'] for row in reopened['checkpoints']] == [row['id'] for row in rows]
print(json.dumps({'checkpoints':len(rows),'domains':16,'successful_evidence_files':len(cache),'complete':False}))
