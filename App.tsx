import React, {useState} from 'react';
import {Alert, Button, Platform, StyleSheet, Text, View} from 'react-native';
import {
  ApolloProvider,
  useMutation,
} from '@apollo/client';

import {
  DiscoveryDocument,
  makeRedirectUri,
  useAuthRequest,
  useAutoDiscovery
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  GET_OR_CREATE_PERSON,
  AuthCodeResponse,
  AccessToken,
  formUrlEncode
} from './extra';
import {
  CLIENT_ID,
  KEYCLOAK_DISCOVERY_URL,
  KEYCLOAK_DISCOVERY_DOMAIN,
  NATIVE_REDIRECT_URI,
  EXPIRED_TOKEN,
} from './constants'; // this one is not in version control
import jwtDecode from 'jwt-decode';
import {createWebsocketClient} from "./graphql";

let accessToken: string | null = EXPIRED_TOKEN;
let refreshToken: string | null = '';
let discoveryDocument: DiscoveryDocument | null = null;

async function getTokens(): Promise<string | undefined> {
  try {
    const resp = await fetch(discoveryDocument?.tokenEndpoint || 'http://localhost', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formUrlEncode({
        /* eslint-disable @typescript-eslint/camelcase */
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const authCodeResponse = (await resp.json()) as AuthCodeResponse;
    accessToken = authCodeResponse.access_token;
    refreshToken = authCodeResponse.refresh_token;
    return authCodeResponse.access_token || '';
  } catch (e) {
    console.log(e);
  }
}

const client = createWebsocketClient(getTokens);

WebBrowser.maybeCompleteAuthSession();

function UserInfo() {
  const discovery = useAutoDiscovery(KEYCLOAK_DISCOVERY_URL);
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      extraParams: {nonce: 'skjDgeF5sG'},
      scopes: ['openid'],
      redirectUri: makeRedirectUri({
        native: NATIVE_REDIRECT_URI,
      }),
    },
    discovery,
  );

  const [getOrCreatePerson, {data, error, loading}] = useMutation(GET_OR_CREATE_PERSON);
  const [AuthcodeResponse, setAuthCodeResponse] = useState<AuthCodeResponse>();
  const [familyName, setFamilyName] = useState<string>('');
  const [givenName, setGivenName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [state, setState] = useState<string>('logged out');

  React.useEffect(() => {
    const getCred = async (): Promise<void> => {
      if (response) {
        console.log('getCred found response:', response);
        if (response.type === 'error') {
          if (Platform.OS === 'web') {
            // eslint-disable-next-line no-alert
            alert(`Authentication error: ${response.params.error_description || 'something went wrong'}`);
          } else {
            Alert.alert('Authentication error', response.params.error_description || 'something went wrong');
          }
          return;
        }
        if (response.type === 'success') {
          discoveryDocument = discovery;
          try {
            const resp = await fetch(discovery?.tokenEndpoint || 'http://localhost', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formUrlEncode({
                /* eslint-disable @typescript-eslint/camelcase */
                client_id: CLIENT_ID,
                redirect_uri: makeRedirectUri({
                  native: 'neemop://redirect',
                }),
                code: response.params.code,
                grant_type: 'authorization_code',
                code_verifier: request?.codeVerifier || '',
              }),
            });
            const authCodeResponse = (await resp.json()) as AuthCodeResponse;
            setAuthCodeResponse(authCodeResponse);
            accessToken = authCodeResponse.access_token || 'none';
            refreshToken = authCodeResponse.refresh_token || 'none';
            console.log('accessToken=', accessToken);
          } catch (e) {
            const msg = `Could not get your information from ${KEYCLOAK_DISCOVERY_DOMAIN}.\nError text: ${e || 'something went wrong, that\'s all we know'}`;
            if (Platform.OS === 'web') {
              // eslint-disable-next-line no-alert
              alert(msg);
            } else {
              Alert.alert('Authentication error', msg);
            }
          }
        }
      } else {
        console.log('getCred called, but response not set');
      }
    };
    getCred().then();
  }, [response]);

  const getOrCreate = async () => {
    if (AuthcodeResponse) {
      const accessToken = jwtDecode(AuthcodeResponse.access_token || '') as AccessToken;
      return getOrCreatePerson({
        variables: {
          external_id: accessToken.sub,
          given_name: accessToken.given_name,
          family_name: accessToken.family_name,
          email: accessToken.email,
        },
      })
    }
  };

  React.useEffect(() => {
    if (AuthcodeResponse) {
      console.log('useEffect called on AuthcodeResponse:', AuthcodeResponse);
      // const accessToken = jwtDecode(AuthcodeResponse.access_token || '') as AccessToken;
      getOrCreate().then();
    } else {
      console.log('useEffect called but AuthcodeResponse is null');
    }
  }, [AuthcodeResponse]);

  React.useEffect(() => {
    if (data) {
      console.log('useEffect called on data:', data);
      const record = data.insert_identity.returning[0];
      console.log(data.insert_identity.returning[0].id);
      console.log(data.insert_identity.returning[0].personByPerson.given_name);
      console.log(data.insert_identity.returning[0].personByPerson.family_name);
      console.log(data.insert_identity.returning[0].personByPerson.email);
      setFamilyName(record.personByPerson.family_name);
      setGivenName(record.personByPerson.given_name);
      setEmail(record.personByPerson.email);
      setState('logged in');
    } else {
      console.log('useEffect called but data is null');
    }
  }, [data]);

  if (loading) {
    console.log('Loading..');
    return <Text>Loading...</Text>;
  }
  if (error) {
    console.log('error:', error); // should probably throw
    return (
      <View>
        <Text>{`Error: ${error.message}`}</Text>
        <Button title='Try Again' onPress={() => {
          console.log('button pressed');
          getOrCreate().then();
        }}/>
      </View>
    );
  }

  console.log('rendering..');
  console.log('authcoderesponse', AuthcodeResponse);
  console.log('data', data);
  return (
    <View>
      <Text>{`${givenName} ${familyName} ${email}`}</Text>
      <View style={{padding: 10}}>
        <Button title='Login' onPress={() => {
          console.log('button pressed');
          promptAsync().then();
        }}/>
      </View>
      <View style={{padding: 10}}>
        {state === 'logged in' && <Button color='red' title='Logout' onPress={() => {
          setAuthCodeResponse(undefined);
          setFamilyName('');
          setGivenName('');
          setEmail('');
          setState('logged out');
        }}/>}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <View style={styles.container}>
        <UserInfo/>
      </View>
    </ApolloProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
