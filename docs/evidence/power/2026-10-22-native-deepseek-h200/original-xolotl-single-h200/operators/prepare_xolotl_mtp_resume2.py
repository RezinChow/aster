"""Freeze one short continuation for the terminal download's final100MB."""
import ast
from xolotl_trial_common import BASE
p=BASE/'resume_xolotl_original_mtp_windows_v2.frozen.py'
if p.exists():raise RuntimeError('second resume already frozen; inspect its receipt')
s=(BASE/'resume_xolotl_original_mtp_windows.py').read_text()
a='xolotl-original-mtp-windows-download-latest.json'
if s.count(a)!=1:raise RuntimeError('prior download receipt anchor differs')
s=s.replace(a,'__PREVIOUS_RESUME_RECEIPT__')
for a,b in [('xolotl-original-mtp-windows-resume1-intent.json','xolotl-original-mtp-windows-resume2-intent.json'),('xolotl-original-mtp-windows-resume1-latest.json','xolotl-original-mtp-windows-resume2-latest.json'),('resume1.stderr.log','resume2.stderr.log')]:
 if s.count(a)!=1:raise RuntimeError('second resume anchor differs: '+a)
 s=s.replace(a,b)
s=s.replace('__PREVIOUS_RESUME_RECEIPT__','xolotl-original-mtp-windows-resume1-latest.json')
if s.count('3600')!=3:raise RuntimeError('bounded resume duration sites differ')
s=s.replace('3600','300');ast.parse(s);p.write_text(s)
print('Prepared a separate300-second last-range resume; previous PID must be terminal and entire final SHA must match.')
