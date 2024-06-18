import admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

const {
  SERVICE_ACCOUNT_TYPE: type,
  SERVICE_ACCOUNT_PROJECT_ID: project_id,
  SERVICE_ACCOUNT_PRIVATE_KEY_ID: private_key_id,
  SERVICE_ACCOUNT_PRIVATE_KEY: private_key,
  SERVICE_ACCOUNT_CLIENT_EMAIL: client_email,
  SERVICE_ACCOUNT_CLIENT_ID: client_id,
  SERVICE_ACCOUNT_AUTH_URI: auth_uri,
  SERVICE_ACCOUNT_TOKEN_URI: token_uri,
  SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL: auth_provider_x509_cert_url,
  SERVICE_ACCOUNT_CLIENT_X509_CERT_URL: client_x509_cert_url,
  SERVICE_ACCOUNT_UNIVERSE_DOMAIN: universe_domain,
} = process.env;

const serviceAccount = {
  type,
  project_id,
  private_key_id,
  private_key,
  client_email,
  client_id,
  auth_uri,
  token_uri,
  auth_provider_x509_cert_url,
  client_x509_cert_url,
  universe_domain,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "real-talk-70785",
});

// const message = {
//   notification: {
//     title: "Notif",
//     body: "This is a Test Notification",
//   },
//   token:
//     "cxVXQONZqhfve07MVlm0j0:APA91bFb_fxKTenYogSzcaGlTC9ytQkT1m9zNmK0qnbV1HtqCT9E9ZwJjGxMFssv1Sd-_p7xzmx2JrjlaWWBy8mbjoEOa-17d9kYu2F_hrQNhYH0Blc-hgS_ZByvXjAem0_z8XBZZtAd",
// };

const sendNotification = async (message) => {
  try {
    const result = await getMessaging().send(message);
  } catch (error) {
    console.log(error);
  }
};

export default sendNotification;
