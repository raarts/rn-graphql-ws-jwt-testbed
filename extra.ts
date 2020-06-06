import {gql} from "@apollo/client";
import * as WebBrowser from "expo-web-browser";

const GET_OR_CREATE_PERSON = gql`
  mutation insert_identity($given_name: String!, $family_name: String!, $email: String!, $external_id: String!) {
    insert_identity(
      objects: [
        {
          external_id: $external_id
          personByPerson: {
            data: { given_name: $given_name, family_name: $family_name, email: $email }
            on_conflict: { constraint: person_email_index, update_columns: [last_login] }
          }
        }
      ]
      on_conflict: { constraint: external_id_unique, update_columns: [external_id] }
    ) {
      affected_rows
      returning {
        id
        personByPerson {
          family_name
          given_name
          email
        }
      }
    }
  }
`;

interface AuthCodeResponse {
  access_token: string | null;
  expires_in: number;
  id_token: string | null;
  'not-before-policy': number;
  refresh_expires_in: number;
  refresh_token: string | null;
  scope: string;
  session_state: string;
  token_type: string;
}

interface AccessToken {
  acr: string;
  'allowed-origins': string[];
  aud: string;
  auth_time: number;
  azp: string;
  email: string;
  exp: number;
  family_name: string;
  given_name: string;
  iat: number;
  iss: string;
  jti: string;
  name: string;
  nbf: number;
  nonce: string;
  preferred_username: string;
  realm_access: {
    roles: string[];
  };
  resource_access: {
    account: {
      roles: string[];
    };
  };
  scope: string;
  session_state: string;
  sub: string;
  typ: string;
}

const formUrlEncode = (obj: object): string => {
  const formBody: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(value || 'null');
    formBody.push(`${encodedKey}=${encodedValue}`);
  });
  return formBody.join('&');
};

export {
  GET_OR_CREATE_PERSON,
  AuthCodeResponse,
  AccessToken,
  formUrlEncode
}

