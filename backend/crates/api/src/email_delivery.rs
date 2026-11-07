use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, header::ContentType},
    transport::smtp::authentication::Credentials,
};
use thiserror::Error;
use url::Url;

use crate::config::{EmailConfig, SmtpSecurity};

#[derive(Clone)]
pub struct EmailDelivery {
    from: Mailbox,
    public_origin: Url,
    transport: AsyncSmtpTransport<Tokio1Executor>,
}

#[derive(Debug, Error)]
pub enum EmailDeliveryError {
    #[error("email delivery configuration is invalid")]
    Configuration,
    #[error("email could not be delivered")]
    Delivery,
}

impl EmailDelivery {
    pub fn new(config: &EmailConfig, public_origin: &str) -> Result<Self, EmailDeliveryError> {
        let from = Mailbox::new(
            Some(config.from_name.clone()),
            config
                .from_address
                .parse()
                .map_err(|_| EmailDeliveryError::Configuration)?,
        );
        let mut builder = match config.smtp_security {
            SmtpSecurity::None => {
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(config.smtp_host.clone())
            }
            SmtpSecurity::StartTls => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.smtp_host)
                    .map_err(|_| EmailDeliveryError::Configuration)?
            }
        }
        .port(config.smtp_port);
        if let (Some(username), Some(password)) = (&config.smtp_username, &config.smtp_password) {
            builder = builder.credentials(Credentials::new(username.clone(), password.clone()));
        }

        Ok(Self {
            from,
            public_origin: Url::parse(public_origin)
                .map_err(|_| EmailDeliveryError::Configuration)?,
            transport: builder.build(),
        })
    }

    pub async fn send_password_reset(
        &self,
        recipient: &str,
        token: &str,
    ) -> Result<(), EmailDeliveryError> {
        let recipient: Mailbox = recipient
            .parse()
            .map_err(|_| EmailDeliveryError::Configuration)?;
        let reset_url = password_reset_url(&self.public_origin, recipient.email.as_ref(), token)?;
        let email = Message::builder()
            .from(self.from.clone())
            .to(recipient)
            .subject("Reset your Wicked Learning password")
            .header(ContentType::TEXT_PLAIN)
            .body(format!(
                "You are receiving this email because we received a password reset request for your Wicked Learning account.\n\nReset your password: {reset_url}\n\nThis password reset link expires in 60 minutes. If you did not request a password reset, no further action is required."
            ))
            .map_err(|_| EmailDeliveryError::Configuration)?;
        self.transport
            .send(email)
            .await
            .map_err(|_| EmailDeliveryError::Delivery)?;
        Ok(())
    }
}

fn password_reset_url(
    public_origin: &Url,
    email: &str,
    token: &str,
) -> Result<Url, EmailDeliveryError> {
    let mut reset_url = public_origin.clone();
    reset_url.set_path(&format!("/reset-password/{token}"));
    reset_url.set_query(None);
    reset_url.query_pairs_mut().append_pair("email", email);
    Ok(reset_url)
}

#[cfg(test)]
mod tests {
    use url::Url;

    use super::password_reset_url;

    #[test]
    fn password_reset_links_keep_email_in_query_and_token_in_source_path() {
        let url = password_reset_url(
            &Url::parse("https://learn.example.test").expect("valid origin"),
            "learner+reset@example.test",
            "opaque-token",
        )
        .expect("reset URL");

        assert_eq!(url.path(), "/reset-password/opaque-token");
        assert_eq!(
            url.query_pairs().collect::<Vec<_>>(),
            vec![("email".into(), "learner+reset@example.test".into()),]
        );
    }
}
