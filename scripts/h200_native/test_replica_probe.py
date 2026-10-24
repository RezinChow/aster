"""Hermetic receipt checks; these tests execute no model or GPU work."""
import copy
import unittest
import uuid

from replica_probe import MODEL_SHA, validate_generation, validate_ready


class ReplicaReceiptTests(unittest.TestCase):
    def test_ready_requires_both_exact_physical_devices_and_memory_admission(self):
        pair = ['GPU-4b9d48d5-7c19-8737-1971-6d8f4250ad85',
                'GPU-a3aa5f68-33fb-afcb-53f0-d64ea22567fb']
        ready = dict(phase='model_loaded', model_sha256=MODEL_SHA, device_admissions=[
            dict(ordinal=index, uuid=list(uuid.UUID(identity[4:]).bytes), capability=[9, 0],
                 residentUpperBytes=70, totalBytes=140, stateAndDriverReserve=30,
                 freeBytesAtLoad=120) for index, identity in enumerate(pair)])
        validate_ready(ready, pair)
        for mutate in [lambda value: value['device_admissions'].reverse(),
                       lambda value: value['device_admissions'][1].update(ordinal=0),
                       lambda value: value['device_admissions'][0].update(freeBytesAtLoad=99),
                       lambda value: value.update(model_sha256='0' * 64)]:
            invalid = copy.deepcopy(ready)
            mutate(invalid)
            with self.assertRaises(RuntimeError):
                validate_ready(invalid, pair)

    def test_generation_requires_complete_forty_layer_execution_on_only_its_pair(self):
        receipt = dict(phase='generated', model_sha256=MODEL_SHA, native_execution=True,
                       group_width='2', generation=dict(tokens=[42, 43],
                           stats=dict(modelSteps=5, executedLayersByOrdinal=[100, 100] + [0] * 6)))
        self.assertEqual(validate_generation(receipt), [42, 43])
        for mutate in [lambda value: value.update(native_execution=False),
                       lambda value: value['generation']['stats'].update(executedLayersByOrdinal=[100] * 8),
                       lambda value: value['generation']['stats'].update(executedLayersByOrdinal=[100, 99] + [0] * 6),
                       lambda value: value['generation'].update(tokens=[])]:
            invalid = copy.deepcopy(receipt)
            mutate(invalid)
            with self.assertRaises(RuntimeError):
                validate_generation(invalid)


if __name__ == '__main__':
    unittest.main()
