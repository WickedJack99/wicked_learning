use uuid::Uuid;

#[derive(Clone, Debug, PartialEq)]
pub struct ActivityAmbientSoundForm {
    pub enabled: bool,
    pub sound_id: Option<Uuid>,
}

impl ActivityAmbientSoundForm {
    pub fn parse(enabled: bool, sound_id: Option<&str>) -> Option<Self> {
        let sound_id = match sound_id.map(str::trim).filter(|value| !value.is_empty()) {
            Some(value) => Some(Uuid::parse_str(value).ok()?),
            None => None,
        };

        Some(Self { enabled, sound_id })
    }
}

#[cfg(test)]
mod tests {
    use super::ActivityAmbientSoundForm;

    #[test]
    fn accepts_only_a_uuid_sound_or_an_explicit_clear() {
        assert!(
            ActivityAmbientSoundForm::parse(true, Some("00000000-0000-4000-8000-000000000001"))
                .is_some()
        );
        assert!(ActivityAmbientSoundForm::parse(false, None).is_some());
        assert!(ActivityAmbientSoundForm::parse(true, Some("sound")).is_none());
    }
}
