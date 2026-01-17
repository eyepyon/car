#!/usr/bin/env python3
"""
Privacy Validation Script for ERC-4337 Privacy-Protected Wallets

This script validates that smart contracts properly protect sensitive information
and do not leak privacy-critical data on-chain.

Usage:
    python validate_privacy.py <contract_file.sol>

Checks performed:
1. No raw sensitive data (plate numbers, personal info) in storage
2. Only commitments (hashes) are stored
3. No sensitive data in events
4. Proper use of view/pure for verification functions
5. No logging of sensitive preimages
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict
from dataclasses import dataclass

@dataclass
class PrivacyViolation:
    """Represents a privacy violation found in the code"""
    severity: str  # 'critical', 'high', 'medium', 'low'
    location: str  # File and line number
    rule: str      # Which privacy rule was violated
    message: str   # Description of the violation
    suggestion: str  # How to fix it

class PrivacyValidator:
    def __init__(self):
        self.violations: List[PrivacyViolation] = []

        # Patterns that indicate sensitive data storage
        self.sensitive_patterns = [
            (r'string\s+(public|internal)\s+\w*[Pp]late',
             'Plate numbers should never be stored as strings'),
            (r'string\s+(public|internal)\s+\w*[Nn]umber',
             'Vehicle numbers should never be stored as strings'),
            (r'string\s+(public|internal)\s+\w*[Ii]dentif',
             'Identifiers should be stored as commitments (bytes32), not strings'),
            (r'emit\s+\w+\([^)]*string[^)]*\)',
             'Events should not emit string data that might contain sensitive info'),
        ]

        # Required patterns for proper privacy protection
        self.required_patterns = [
            (r'bytes32.*[Cc]ommitment',
             'Commitments (bytes32) should be used for sensitive data'),
            (r'keccak256\(abi\.encodePacked\(',
             'Proper hashing should be used to create commitments'),
        ]

        # Dangerous functions that might leak data
        self.dangerous_functions = [
            (r'function\s+\w*[Vv]erify\w*\([^)]*string[^)]*\)\s+external\s+(?!view|pure)',
             'Verification functions that take sensitive strings must be view/pure'),
            (r'console\.log\([^)]*string[^)]*\)',
             'Never log sensitive strings, even in development'),
        ]

    def check_file(self, filepath: Path) -> List[PrivacyViolation]:
        """Check a Solidity file for privacy violations"""
        if not filepath.exists():
            print(f"Error: File {filepath} does not exist")
            sys.exit(1)

        content = filepath.read_text()
        lines = content.split('\n')

        # Check for sensitive data storage
        for i, line in enumerate(lines, 1):
            for pattern, message in self.sensitive_patterns:
                if re.search(pattern, line):
                    self.violations.append(PrivacyViolation(
                        severity='critical',
                        location=f'{filepath.name}:{i}',
                        rule='NO_SENSITIVE_STORAGE',
                        message=message,
                        suggestion='Use bytes32 commitment (keccak256 hash) instead of storing raw data'
                    ))

        # Check for dangerous functions
        for i, line in enumerate(lines, 1):
            for pattern, message in self.dangerous_functions:
                if re.search(pattern, line):
                    self.violations.append(PrivacyViolation(
                        severity='high',
                        location=f'{filepath.name}:{i}',
                        rule='DANGEROUS_FUNCTION',
                        message=message,
                        suggestion='Make function view/pure or move verification off-chain'
                    ))

        # Check for proper commitment usage
        has_commitment = any(
            re.search(pattern, content)
            for pattern, _ in self.required_patterns
        )

        if not has_commitment:
            self.violations.append(PrivacyViolation(
                severity='medium',
                location=f'{filepath.name}:general',
                rule='MISSING_COMMITMENT',
                message='No commitment pattern found in contract',
                suggestion='Use bytes32 commitments with keccak256 for sensitive data'
            ))

        return self.violations

    def check_event_safety(self, filepath: Path) -> List[PrivacyViolation]:
        """Check that events don't leak sensitive data"""
        content = filepath.read_text()

        # Find all event definitions
        event_pattern = r'event\s+(\w+)\s*\(([^)]+)\)'
        events = re.finditer(event_pattern, content)

        for event in events:
            event_name = event.group(1)
            params = event.group(2)

            # Check if event contains string parameters (potential leak)
            if 'string' in params and 'Hash' not in event_name:
                line_num = content[:event.start()].count('\n') + 1
                self.violations.append(PrivacyViolation(
                    severity='high',
                    location=f'{filepath.name}:{line_num}',
                    rule='EVENT_DATA_LEAK',
                    message=f'Event {event_name} contains string parameter that might leak data',
                    suggestion='Use indexed bytes32 commitments in events instead of strings'
                ))

        return self.violations

    def check_function_visibility(self, filepath: Path) -> List[PrivacyViolation]:
        """Check that verification functions have proper visibility"""
        content = filepath.read_text()
        lines = content.split('\n')

        # Find verification functions
        verify_pattern = r'function\s+(verify\w*|check\w*)\s*\([^)]*string[^)]*\)'

        for i, line in enumerate(lines, 1):
            match = re.search(verify_pattern, line, re.IGNORECASE)
            if match:
                func_name = match.group(1)
                # Check if next few lines contain 'view' or 'pure'
                context = ' '.join(lines[i-1:min(i+3, len(lines))])

                if 'view' not in context and 'pure' not in context:
                    self.violations.append(PrivacyViolation(
                        severity='critical',
                        location=f'{filepath.name}:{i}',
                        rule='VERIFICATION_VISIBILITY',
                        message=f'Function {func_name} takes sensitive string but is not view/pure',
                        suggestion='Mark as view or pure, or move verification off-chain'
                    ))

        return self.violations

    def generate_report(self) -> str:
        """Generate a privacy validation report"""
        if not self.violations:
            return "\n✅ PRIVACY VALIDATION PASSED\nNo privacy violations detected.\n"

        report = ["\n❌ PRIVACY VALIDATION FAILED\n"]
        report.append(f"Found {len(self.violations)} privacy violation(s):\n")

        # Group by severity
        violations_by_severity = {}
        for v in self.violations:
            violations_by_severity.setdefault(v.severity, []).append(v)

        for severity in ['critical', 'high', 'medium', 'low']:
            if severity in violations_by_severity:
                report.append(f"\n{severity.upper()} SEVERITY:\n{'-' * 50}")
                for v in violations_by_severity[severity]:
                    report.append(f"\n📍 {v.location}")
                    report.append(f"  Rule: {v.rule}")
                    report.append(f"  Issue: {v.message}")
                    report.append(f"  Fix: {v.suggestion}\n")

        return '\n'.join(report)

def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_privacy.py <contract_file.sol>")
        print("\nExample:")
        print("  python validate_privacy.py PrivacyProtectedAccount.sol")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    print(f"\n🔍 Validating privacy protection in: {filepath.name}")
    print("=" * 60)

    validator = PrivacyValidator()

    # Run all checks
    validator.check_file(filepath)
    validator.check_event_safety(filepath)
    validator.check_function_visibility(filepath)

    # Generate and print report
    report = validator.generate_report()
    print(report)

    # Exit with error code if violations found
    if validator.violations:
        critical_count = sum(1 for v in validator.violations if v.severity == 'critical')
        high_count = sum(1 for v in validator.violations if v.severity == 'high')

        if critical_count > 0:
            print(f"\n⚠️  CRITICAL: {critical_count} critical privacy violation(s) must be fixed!")
            sys.exit(2)
        elif high_count > 0:
            print(f"\n⚠️  WARNING: {high_count} high severity violation(s) should be addressed.")
            sys.exit(1)
    else:
        print("✨ All privacy checks passed! Contract properly protects sensitive data.")
        sys.exit(0)

if __name__ == "__main__":
    main()
