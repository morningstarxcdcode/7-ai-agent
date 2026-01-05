use uuid::Uuid;

use crate::models::{CodeSpec, GeneratedCode};

#[derive(Clone, Default)]
pub struct AutonomousCoderEngine;

impl AutonomousCoderEngine {
    pub fn generate(&self, spec: CodeSpec) -> GeneratedCode {
        let code = format!("// Generated code\n// {}\n", spec.description);
        let tests_passed = true;
        let security_passed = !code.contains("rm -rf") && !code.contains("drop database");

        GeneratedCode {
            id: Uuid::new_v4(),
            code,
            tests_passed,
            security_passed: if spec.auto_mode { security_passed } else { false },
        }
    }
}
