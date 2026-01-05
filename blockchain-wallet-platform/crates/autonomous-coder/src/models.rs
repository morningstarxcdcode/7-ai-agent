use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSpec {
    pub description: String,
    pub auto_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedCode {
    pub id: Uuid,
    pub code: String,
    pub tests_passed: bool,
    pub security_passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateCodeRequest {
    pub spec: CodeSpec,
}
