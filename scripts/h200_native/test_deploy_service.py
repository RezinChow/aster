"""Native deployment admission receipts; no allocation, GPU or key generation."""
import copy
import unittest
import uuid

from deploy_service import validate_admissions


class ServiceAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.identities = ['GPU-' + str(uuid.UUID(int=index + 1)) for index in range(8)]
        self.admissions = [[dict(ordinal=group * 2 + local, capability=[9, 0],
            uuid=list(uuid.UUID(self.identities[group * 2 + local][4:]).bytes),
            residentUpperBytes=80, stateAndDriverReserve=30, freeBytesAtLoad=140)
            for local in range(2)] for group in range(4)]

    def test_four_complete_groups_must_bind_their_own_global_process_ordinals(self):
        validate_admissions(self.admissions, self.identities)
        for mutate in [lambda value: value[1][0].update(ordinal=0),
                       lambda value: value[2].reverse(),
                       lambda value: value[3][1].update(uuid=self.admissions[0][0]['uuid'])]:
            invalid = copy.deepcopy(self.admissions)
            mutate(invalid)
            with self.assertRaises(RuntimeError):
                validate_admissions(invalid, self.identities)

    def test_missing_replicas_foreign_hardware_and_excess_memory_are_refused(self):
        for mutate in [lambda value: value.pop(),
                       lambda value: value[0][0].update(capability=[8, 0]),
                       lambda value: value[0][0].update(freeBytesAtLoad=100)]:
            invalid = copy.deepcopy(self.admissions)
            mutate(invalid)
            with self.assertRaises(RuntimeError):
                validate_admissions(invalid, self.identities)


if __name__ == '__main__':
    unittest.main()
