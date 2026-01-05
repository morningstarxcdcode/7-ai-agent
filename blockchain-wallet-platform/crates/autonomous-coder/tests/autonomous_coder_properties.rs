use proptest::prelude::*;

use autonomous_coder::engine::AutonomousCoderEngine;
use autonomous_coder::models::CodeSpec;

proptest! {
    #[test]
    fn property_autonomous_code_generation(description in ".{10,100}") {
        let engine = AutonomousCoderEngine::default();
        let spec = CodeSpec { description, auto_mode: true };
        let result = engine.generate(spec);
        prop_assert!(result.tests_passed);
        prop_assert!(result.security_passed);
    }

    #[test]
    fn property_security_validation_gate(description in ".{10,100}") {
        let engine = AutonomousCoderEngine::default();
        let spec = CodeSpec { description, auto_mode: false };
        let result = engine.generate(spec);
        prop_assert!(!result.security_passed);
    }
}
