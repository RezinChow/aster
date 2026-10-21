#!/usr/bin/env python3
"""107-V1: global order audit, out-of-order event ledger, reconciliation and
budget-constrained action optimization.

Usage:
    python pipeline.py --input input --output output

Standard library only. Deterministic output, no timestamps/paths/randomness.
"""

import argparse
import bisect
import csv
import hashlib
import json
import os
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction

MARKET_SUFFIX = "_orders.csv"
MILLI = 1000
PPM = 1000000
BP = 10000
HIGH_DISCOUNT_PPM = 200000
EVENT_TYPES = ("cancel", "refund", "shipping_credit")
SCHEMA_VERSION = "107-v1"


# --------------------------------------------------------------------------
# exact arithmetic helpers
# --------------------------------------------------------------------------
def round_half_up_fraction(fr):
    """ROUND_HALF_UP (away from zero on ties) of an exact Fraction -> int."""
    num, den = fr.numerator, fr.denominator
    if num >= 0:
        return (2 * num + den) // (2 * den)
    return -((2 * (-num) + den) // (2 * den))


def fmt_fraction(fr, decimals):
    """Fixed-width decimal string of an exact Fraction using ROUND_HALF_UP."""
    n = round_half_up_fraction(Fraction(fr) * (10 ** decimals))
    sign = "-" if n < 0 else ""
    n = abs(n)
    if decimals == 0:
        return sign + str(n)
    s = str(n).rjust(decimals + 1, "0")
    return sign + s[:-decimals] + "." + s[-decimals:]


def fmt_reference(text, decimals):
    """Normalize a reference CSV value to the required fixed width."""
    raw = ("" if text is None else str(text)).strip()
    if raw == "":
        return ""
    try:
        value = Decimal(raw)
    except Exception:
        return raw
    if not value.is_finite():
        return raw
    quant = Decimal(1).scaleb(-decimals)
    return str(value.quantize(quant, rounding=ROUND_HALF_UP))


def parse_scaled(text, scale):
    """Parse a decimal string into an exact integer of `scale` sub-units."""
    raw = ("" if text is None else str(text)).strip()
    if raw == "":
        return 0
    value = Decimal(raw) * scale
    if value == value.to_integral_value():
        return int(value)
    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def parse_int(text):
    raw = ("" if text is None else str(text)).strip()
    if raw == "":
        return 0
    return int(Decimal(raw))


# --------------------------------------------------------------------------
# input loading
# --------------------------------------------------------------------------
def load_reference(path):
    """Return (group_column, field_names, rows) for a reference summary CSV."""
    with open(path, "r", newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        header = None
        rows = []
        for raw in reader:
            if not raw or all((c or "").strip() == "" for c in raw):
                continue
            if header is None:
                header = [(c or "").strip() for c in raw]
                continue
            rows.append(raw)
    if not header:
        return None, [], []
    group_col = header[0]
    fields = header[1:]
    records = []
    for raw in rows:
        values = {}
        for i, name in enumerate(header):
            values[name] = raw[i] if i < len(raw) else ""
        records.append(values)
    return group_col, fields, records


def load_products(path):
    products = {}
    with open(path, "r", newline="", encoding="utf-8-sig") as fh:
        for rec in csv.DictReader(fh):
            pid = (rec.get("Product ID") or "").strip()
            if not pid:
                continue
            if pid not in products:
                products[pid] = (
                    (rec.get("Category") or "").strip(),
                    (rec.get("Sub-Category") or "").strip(),
                )
    return products


def load_orders(input_dir, products):
    rows = []
    for name in sorted(os.listdir(input_dir)):
        if not name.endswith(MARKET_SUFFIX):
            continue
        path = os.path.join(input_dir, name)
        if not os.path.isfile(path):
            continue
        market = name[: -len(MARKET_SUFFIX)]
        with open(path, "r", newline="", encoding="utf-8-sig") as fh:
            seq = 0
            for rec in csv.DictReader(fh):
                values = list(rec.values())
                if all((v is None or str(v).strip() == "") for v in values):
                    continue
                seq += 1
                product_id = (rec.get("Product ID") or "").strip()
                category, sub_category = products.get(product_id, ("", ""))
                order_date = (rec.get("Order Date") or "").strip()
                ship_date = (rec.get("Ship Date") or "").strip()
                rows.append(
                    {
                        "row_key": "%s:%06d" % (name, seq),
                        "source_file": name,
                        "source_row": seq,
                        "order_id": (rec.get("Order ID") or "").strip(),
                        "product_id": product_id,
                        "market": market,
                        "category": category,
                        "sub_category": sub_category,
                        "segment": (rec.get("Segment") or "").strip(),
                        "ship_mode": (rec.get("Ship Mode") or "").strip(),
                        "priority": (rec.get("Order Priority") or "").strip(),
                        "order_date": order_date,
                        "ship_date": ship_date,
                        "delivery_days": days_between(order_date, ship_date),
                        "quantity": parse_int(rec.get("Quantity")),
                        "sales_milli": parse_scaled(rec.get("Sales"), MILLI),
                        "profit_milli": parse_scaled(rec.get("Profit"), MILLI),
                        "shipping_milli": parse_scaled(rec.get("Shipping Cost"), MILLI),
                        "discount_ppm": parse_scaled(rec.get("Discount"), PPM),
                    }
                )
    rows.sort(key=lambda r: r["row_key"])
    return rows


def days_between(order_date, ship_date):
    try:
        start = date.fromisoformat(order_date)
        end = date.fromisoformat(ship_date)
        return (end - start).days
    except Exception:
        return 0


def load_events(path):
    records = []
    with open(path, "r", encoding="utf-8-sig") as fh:
        for line in fh:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
            except Exception:
                obj = {}
            if not isinstance(obj, dict):
                obj = {}
            records.append(obj)
    return records


def compute_sha256_map(input_dir):
    digests = {}
    for name in sorted(os.listdir(input_dir)):
        path = os.path.join(input_dir, name)
        if not os.path.isfile(path):
            continue
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        digests[name] = h.hexdigest()
    return digests


# --------------------------------------------------------------------------
# event ledger
# --------------------------------------------------------------------------
def is_strict_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def apply_events(rows, records):
    """Return (event_audit, effective_rows, status_counts)."""
    state = {}
    for row in rows:
        state[row["row_key"]] = {
            "active": True,
            "sales_milli": row["sales_milli"],
            "profit_milli": row["profit_milli"],
            "shipping_milli": row["shipping_milli"],
        }

    audit = []
    seen = set()
    pending = []
    for index, obj in enumerate(records, 1):
        event_id = obj.get("event_id")
        row_key = obj.get("row_key")
        if event_id is None:
            unique = True
        else:
            unique = event_id not in seen
            if unique:
                seen.add(event_id)
        entry = {
            "input_line": index,
            "event_id": event_id,
            "row_key": row_key,
            "status": "duplicate_event" if not unique else None,
        }
        audit.append(entry)
        if unique:
            pending.append((obj, entry))

    pending.sort(key=lambda item: (str(item[0].get("timestamp")), str(item[0].get("event_id"))))

    for obj, entry in pending:
        row_key = obj.get("row_key")
        etype = obj.get("type")
        amount = obj.get("amount_milli")
        if not isinstance(row_key, str) or row_key not in state:
            entry["status"] = "unknown_row"
            continue
        if etype not in EVENT_TYPES:
            entry["status"] = "unknown_type"
            continue
        current = state[row_key]
        if not current["active"]:
            entry["status"] = "order_cancelled"
            continue
        valid = False
        if etype == "cancel":
            valid = is_strict_int(amount) and amount == 0
        elif etype == "refund":
            valid = (
                is_strict_int(amount)
                and amount > 0
                and amount <= current["sales_milli"]
            )
        else:  # shipping_credit
            valid = (
                is_strict_int(amount)
                and amount > 0
                and amount <= current["shipping_milli"]
            )
        if not valid:
            entry["status"] = "invalid_amount"
            continue
        entry["status"] = "applied"
        if etype == "cancel":
            current["active"] = False
            current["sales_milli"] = 0
            current["profit_milli"] = 0
            current["shipping_milli"] = 0
        elif etype == "refund":
            current["sales_milli"] -= amount
            current["profit_milli"] -= amount
        else:
            current["shipping_milli"] -= amount

    effective = []
    for row in rows:
        out = dict(row)
        st = state[row["row_key"]]
        out["sales_milli"] = st["sales_milli"]
        out["profit_milli"] = st["profit_milli"]
        out["shipping_milli"] = st["shipping_milli"]
        out["active"] = st["active"]
        effective.append(out)

    status_counts = {}
    for entry in audit:
        status = entry["status"] or "unknown_row"
        status_counts[status] = status_counts.get(status, 0) + 1
    return audit, effective, status_counts


# --------------------------------------------------------------------------
# metrics
# --------------------------------------------------------------------------
def ratio_bp(numerator, denominator):
    if denominator == 0:
        return None
    return round_half_up_fraction(Fraction(numerator * BP, denominator))


def compute_metrics(rows):
    count = len(rows)
    quantity = 0
    sales = 0
    profit = 0
    shipping = 0
    high_discount = 0
    negative_contribution = 0
    for r in rows:
        quantity += r["quantity"]
        sales += r["sales_milli"]
        profit += r["profit_milli"]
        shipping += r["shipping_milli"]
        if r["discount_ppm"] > HIGH_DISCOUNT_PPM:
            high_discount += 1
        if r["profit_milli"] < r["shipping_milli"]:
            negative_contribution += 1
    contribution = profit - shipping
    return {
        "row_count": count,
        "quantity": quantity,
        "sales_milli": sales,
        "profit_milli": profit,
        "shipping_milli": shipping,
        "contribution_milli": contribution,
        "profit_margin_bp": ratio_bp(profit, sales),
        "contribution_margin_bp": ratio_bp(contribution, sales),
        "high_discount_count": high_discount,
        "negative_contribution_count": negative_contribution,
    }


def month_of(row):
    value = row["order_date"]
    if len(value) >= 7:
        return value[:7]
    return value


def build_aggregates(normalized_rows, effective_rows):
    specs = (
        ("market", ("market",), lambda r: (r["market"],)),
        ("market_category", ("market", "category"), lambda r: (r["market"], r["category"])),
        ("segment", ("segment",), lambda r: (r["segment"],)),
        ("ship_mode", ("ship_mode",), lambda r: (r["ship_mode"],)),
        ("market_month", ("market", "month"), lambda r: (r["market"], month_of(r))),
    )
    result = {}
    for name, fields, keyfunc in specs:
        group_keys = set()
        for row in normalized_rows:
            group_keys.add(keyfunc(row))
        active_groups = {}
        for row in effective_rows:
            if not row["active"]:
                continue
            active_groups.setdefault(keyfunc(row), []).append(row)
        items = []
        for key in sorted(group_keys):
            obj = {}
            for field, value in zip(fields, key):
                obj[field] = value
            obj.update(compute_metrics(active_groups.get(key, [])))
            items.append(obj)
        result[name] = items
    return result


# --------------------------------------------------------------------------
# reconciliation
# --------------------------------------------------------------------------
DECIMALS = {
    "Order_Count": 0,
    "Total_Sales": 2,
    "Total_Profit": 2,
    "Profit_Margin": 2,
    "Avg_Discount": 4,
    "Total_Shipping_Cost": 2,
    "Avg_Shipping_Cost": 2,
    "Avg_Delivery_Days": 2,
}


def segment_actual(rows):
    count = len(rows)
    sales = sum(r["sales_milli"] for r in rows)
    profit = sum(r["profit_milli"] for r in rows)
    discount = sum(r["discount_ppm"] for r in rows)
    values = {
        "Order_Count": str(count),
        "Total_Sales": fmt_fraction(Fraction(sales, MILLI), 2),
        "Total_Profit": fmt_fraction(Fraction(profit, MILLI), 2),
        "Profit_Margin": (
            fmt_fraction(Fraction(profit * 100, sales), 2) if sales else "0.00"
        ),
        "Avg_Discount": (
            fmt_fraction(Fraction(discount, count * PPM), 4) if count else "0.0000"
        ),
    }
    return values


def ship_mode_actual(rows):
    count = len(rows)
    shipping = sum(r["shipping_milli"] for r in rows)
    days = sum(r["delivery_days"] for r in rows)
    values = {
        "Order_Count": str(count),
        "Total_Shipping_Cost": fmt_fraction(Fraction(shipping, MILLI), 2),
        "Avg_Shipping_Cost": (
            fmt_fraction(Fraction(shipping, count * MILLI), 2) if count else "0.00"
        ),
        "Avg_Delivery_Days": (
            fmt_fraction(Fraction(days, count), 2) if count else "0.00"
        ),
    }
    return values


def build_reconciliation(input_dir, normalized_rows):
    plans = (
        ("segment_performance.csv", "Segment", segment_actual, lambda r: r["segment"]),
        ("shipping_by_mode.csv", "Ship_Mode", ship_mode_actual, lambda r: r["ship_mode"]),
    )
    out = []
    for filename, group_column, actual_fn, keyfunc in plans:
        path = os.path.join(input_dir, filename)
        if not os.path.isfile(path):
            continue
        group_col, fields, records = load_reference(path)
        if group_col is None:
            continue
        buckets = {}
        for row in normalized_rows:
            buckets.setdefault(keyfunc(row), []).append(row)
        for rec in records:
            group = (rec.get(group_column) or "").strip()
            actual_values = actual_fn(buckets.get(group, []))
            for field in fields:
                decimals = DECIMALS.get(field, 2)
                actual = actual_values.get(field)
                if actual is None:
                    actual = fmt_fraction(Fraction(0), decimals)
                reference = fmt_reference(rec.get(field), decimals)
                out.append(
                    {
                        "source_file": filename,
                        "group": group,
                        "field": field,
                        "actual": actual,
                        "reference": reference,
                        "match": actual == reference,
                    }
                )
    out.sort(key=lambda o: (o["source_file"], o["group"], o["field"]))
    return out


# --------------------------------------------------------------------------
# action candidates and optimization
# --------------------------------------------------------------------------
def build_candidates(effective_rows, policy):
    priorities = set(policy.get("shipping_priorities") or [])
    shipping_cost = policy.get("shipping_cost_by_market") or {}
    discount_cost = policy.get("discount_cost_by_market") or {}
    saving_bp = int(policy.get("shipping_saving_bp") or 0)
    threshold_ppm = int(policy.get("discount_threshold_ppm") or 0)
    recovery_bp = int(policy.get("discount_recovery_bp") or 0)

    candidates = []
    for row in effective_rows:
        market = row["market"]
        if row["ship_mode"] != "Standard Class" and row["priority"] in priorities:
            cost = shipping_cost.get(market)
            if cost is not None:
                gain = (row["shipping_milli"] * saving_bp) // BP
                if gain > 0:
                    candidates.append(
                        {
                            "action_id": row["row_key"] + "|shipping_switch",
                            "row_key": row["row_key"],
                            "type": "shipping_switch",
                            "cost_units": int(cost),
                            "gain_milli": gain,
                        }
                    )
        if (
            row["discount_ppm"] > threshold_ppm
            and (row["profit_milli"] - row["shipping_milli"]) < 0
        ):
            cost = discount_cost.get(market)
            if cost is not None:
                gain = (row["sales_milli"] * recovery_bp) // BP
                if gain > 0:
                    candidates.append(
                        {
                            "action_id": row["row_key"] + "|discount_review",
                            "row_key": row["row_key"],
                            "type": "discount_review",
                            "cost_units": int(cost),
                            "gain_milli": gain,
                        }
                    )
    candidates.sort(key=lambda c: c["action_id"])
    return candidates


def better(candidate_state, current_state):
    """True when candidate_state beats current_state under the goal order."""
    if current_state is None:
        return True
    c_gain, c_ids = candidate_state
    o_gain, o_ids = current_state
    if c_gain != o_gain:
        return c_gain > o_gain
    return c_ids < o_ids


def optimize(candidates, budget_units):
    groups = {}
    for cand in candidates:
        groups.setdefault(cand["row_key"], []).append(cand)

    dp = {0: (0, ())}
    for row_key in sorted(groups):
        options = groups[row_key]
        nxt = dict(dp)
        for used, (gain, ids) in dp.items():
            for cand in options:
                new_used = used + cand["cost_units"]
                if new_used > budget_units:
                    continue
                new_gain = gain + cand["gain_milli"]
                id_list = list(ids)
                bisect.insort(id_list, cand["action_id"])
                new_ids = tuple(id_list)
                if better((new_gain, new_ids), nxt.get(new_used)):
                    nxt[new_used] = (new_gain, new_ids)
        dp = prune(nxt)

    best_used = None
    best_state = None
    for used, state in dp.items():
        if best_state is None:
            best_used, best_state = used, state
            continue
        gain, ids = state
        b_gain, b_ids = best_state
        if gain > b_gain:
            best_used, best_state = used, state
        elif gain == b_gain:
            if used < best_used:
                best_used, best_state = used, state
            elif used == best_used and ids < b_ids:
                best_used, best_state = used, state

    if best_state is None:
        return 0, 0, []
    gain, ids = best_state
    return best_used, gain, list(ids)


def prune(states):
    """Drop states dominated by a cheaper state with at least as much gain."""
    if len(states) <= 1:
        return states
    kept = {}
    best_gain = None
    for used in sorted(states):
        gain, ids = states[used]
        if best_gain is not None and gain <= best_gain:
            continue
        kept[used] = (gain, ids)
        best_gain = gain
    return kept


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def build_results(input_dir):
    products = load_products(os.path.join(input_dir, "product_info.csv"))
    normalized_rows = load_orders(input_dir, products)

    records = load_events(os.path.join(input_dir, "adjustments.jsonl"))
    event_audit, effective_rows, status_counts = apply_events(normalized_rows, records)

    aggregates = build_aggregates(normalized_rows, effective_rows)
    reconciliation = build_reconciliation(input_dir, normalized_rows)

    active_rows = [r for r in effective_rows if r["active"]]
    summary = compute_metrics(active_rows)
    order_ids = set(r["order_id"] for r in normalized_rows)
    summary["input_row_count"] = len(normalized_rows)
    summary["unique_order_id_count"] = len(order_ids)
    summary["duplicate_order_id_extra_rows"] = len(normalized_rows) - len(order_ids)
    summary["cancelled_row_count"] = len(effective_rows) - len(active_rows)
    summary["event_status_counts"] = dict(
        (status, status_counts[status]) for status in sorted(status_counts)
    )

    with open(os.path.join(input_dir, "policy.json"), "r", encoding="utf-8-sig") as fh:
        policy = json.load(fh)
    budget_units = int(policy.get("budget_units") or 0)

    candidates = build_candidates(effective_rows, policy)
    spent, gain, selected_ids = optimize(candidates, budget_units)
    by_id = dict((c["action_id"], c) for c in candidates)
    selected_actions = [by_id[aid] for aid in selected_ids]
    selected_actions.sort(key=lambda c: c["action_id"])

    current_contribution = sum(
        r["profit_milli"] - r["shipping_milli"] for r in active_rows
    )
    optimization = {
        "budget_units": budget_units,
        "spent_units": spent,
        "gain_milli": gain,
        "selected_action_ids": list(selected_ids),
        "projected_contribution_milli": current_contribution + gain,
    }

    results = {
        "schema_version": SCHEMA_VERSION,
        "normalized_rows": normalized_rows,
        "event_audit": event_audit,
        "effective_rows": effective_rows,
        "aggregates": aggregates,
        "reconciliation": reconciliation,
        "summary": summary,
        "action_candidates": candidates,
        "selected_actions": selected_actions,
        "optimization": optimization,
        "input_sha256": compute_sha256_map(input_dir),
    }
    return results


def main():
    parser = argparse.ArgumentParser(description="107-V1 order pipeline")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    results = build_results(args.input)
    os.makedirs(args.output, exist_ok=True)
    target = os.path.join(args.output, "results.json")
    payload = json.dumps(results, ensure_ascii=False, indent=2, sort_keys=True)
    with open(target, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(payload)
        fh.write("\n")


if __name__ == "__main__":
    main()
