use uuid::Uuid;

use crate::learner_companion::LearnerCompanionRequest;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerCompanionAssistanceLevel {
    Hint,
    Off,
    PostAttempt,
    Question,
}

impl LearnerCompanionAssistanceLevel {
    pub const fn as_response_value(self) -> &'static str {
        match self {
            Self::Hint => "hint",
            Self::Off => "untracked",
            Self::PostAttempt => "post_attempt_support",
            Self::Question => "questions_only",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerCompanionTurnRequest {
    pub assistance_level: LearnerCompanionAssistanceLevel,
    pub dialogue_node_id: String,
    pub play_run_id: Option<Uuid>,
    pub scope: LearnerCompanionRequest,
}

impl LearnerCompanionTurnRequest {
    pub fn parse(
        surface: &str,
        map_slug: Option<&str>,
        activity_id: Option<Uuid>,
        dialogue_node_id: &str,
        assistance_level: &str,
        play_run_id: Option<Uuid>,
    ) -> Option<Self> {
        let scope = LearnerCompanionRequest::parse(surface, map_slug, activity_id)?;
        let dialogue_node_id = dialogue_node_id.trim();
        if dialogue_node_id.is_empty() || dialogue_node_id.chars().count() > 80 {
            return None;
        }
        let assistance_level = match assistance_level {
            "off" => LearnerCompanionAssistanceLevel::Off,
            "question" => LearnerCompanionAssistanceLevel::Question,
            "hint" => LearnerCompanionAssistanceLevel::Hint,
            "post-attempt" => LearnerCompanionAssistanceLevel::PostAttempt,
            _ => return None,
        };
        Some(Self {
            assistance_level,
            dialogue_node_id: dialogue_node_id.to_owned(),
            play_run_id,
            scope,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{LearnerCompanionAssistanceLevel, LearnerCompanionTurnRequest};
    use uuid::Uuid;

    #[test]
    fn accepts_only_the_bounded_source_turn_shape() {
        let activity_id = Uuid::new_v4();
        let run_id = Uuid::new_v4();
        let request = LearnerCompanionTurnRequest::parse(
            "activity",
            None,
            Some(activity_id),
            "  ai-turn  ",
            "question",
            Some(run_id),
        )
        .expect("source-shaped turn");

        assert_eq!(request.dialogue_node_id, "ai-turn");
        assert_eq!(
            request.assistance_level,
            LearnerCompanionAssistanceLevel::Question
        );
        assert_eq!(request.play_run_id, Some(run_id));
        assert!(
            LearnerCompanionTurnRequest::parse(
                "activity",
                None,
                Some(activity_id),
                "ai-turn",
                "answer-for-me",
                None,
            )
            .is_none()
        );
    }
}
