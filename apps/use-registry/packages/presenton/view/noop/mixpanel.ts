// Presenton's analytics client. The view sends nothing anywhere.
const noop = () => {};
const people = { set: noop, set_once: noop, increment: noop, unset: noop };
const mixpanel = {
  init: noop,
  track: noop,
  track_pageview: noop,
  identify: noop,
  reset: noop,
  register: noop,
  register_once: noop,
  unregister: noop,
  opt_in_tracking: noop,
  opt_out_tracking: noop,
  has_opted_out_tracking: () => true,
  get_distinct_id: () => undefined,
  set_config: noop,
  people,
};
export default mixpanel;
