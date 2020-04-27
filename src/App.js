import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import OneGraphAuth from "onegraph-auth";
import "./App.css";

const appId = "2d970fda-a615-4990-9867-4e4191fb916d";

const auth = new OneGraphAuth({
  appId: appId,
});

// This setup is only needed once per application
async function fetchOneGraph(operationsDoc, operationName, variables) {
  const result = await fetch(
    `https://serve.onegraph.com/graphql?app_id=${appId}`,
    {
      method: "POST",
      headers: {
        ...auth.authHeaders(),
      },
      body: JSON.stringify({
        query: operationsDoc,
        variables: variables,
        operationName: operationName,
      }),
    }
  );

  return await result.json();
}

const operationsDoc = `
  query SupportedServicesQuery {
    oneGraph {
      services {
        service
        friendlyServiceName
        slug
        supportsOauthLogin
        supportsCustomServiceAuth
      }
    }
  }
`;

async function fetchSupportedServicesQuery() {
  const result = await fetchOneGraph(
    operationsDoc,
    "SupportedServicesQuery",
    {}
  );

  const oauthServices = result.data.oneGraph && result.data.oneGraph.services;
  const supportedServices = oauthServices
    .filter((service) => service.supportsOauthLogin)
    .sort((a, b) => a.friendlyServiceName.localeCompare(b.friendlyServiceName));

  return supportedServices;
}

function corsPrompt(appId) {
  const origin = window.location.origin;

  return (
    <nav className="cors-prompt">
      <ul>
        <li>
          <a
            className="App-link"
            href={`https://www.onegraph.com/dashboard/app/${appId}?add-cors-origin=${origin}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Please add {origin} to your allowed CORS origins and then refresh
          </a>
        </li>
      </ul>
    </nav>
  );
}

function navBar(appId) {
  return (
    <nav>
      <ul>
        <li>
          <a
            className="App-link"
            href={`https://www.onegraph.com/dashboard/app/${appId}/auth/auth-guardian`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Edit your rules
          </a>
        </li>
        <li>
          <a
            className="App-link"
            href="https://www.onegraph.com/docs/auth_guardian.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            AuthGuardian Docs
          </a>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  const [state, setState] = useState({
    supportedServices: [],
    corsConfigurationRequired: null,
  });

  useEffect(() => {
    fetchSupportedServicesQuery()
      .then((supportedServices) => {
        console.log(supportedServices);
        setState((oldState) => {
          return {
            ...oldState,
            supportedServices: supportedServices,
          };
        });
      })
      // Detect if we haven't configured CORS yet
      .catch((error) => {
        if (
          error.message &&
          error.message.match("not allowed by Access-Control-Allow-Origin")
        ) {
          setState((oldState) => {
            return { ...oldState, corsConfigurationRequired: true };
          });
        }
      });
  }, []);

  const accessToken = auth.accessToken();

  let decoded = null;

  if (!!accessToken) {
    try {
      const payload = atob(accessToken.accessToken.split(".")[1]);
      decoded = JSON.parse(payload);
      delete decoded["https://onegraph.com/jwt/claims"];
    } catch (e) {
      console.warn(`Error decoding OneGraph jwt for appId=${appId}: `, e);
    }
  }

  return (
    <div className="App">
      {state.corsConfigurationRequired ? corsPrompt(appId) : navBar(appId)}
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Your OneGraph auth <code>JWT</code> preview:
        </p>

        <textarea
          className="jwt-preview"
          rows={15}
          value={
            !!decoded ? JSON.stringify(decoded, null, 2) : "No OneGraph JWT"
          }
          readOnly={true}
        ></textarea>
        <textarea
          className="jwt-preview"
          rows={1}
          value={
            !!accessToken && !!accessToken.accessToken
              ? accessToken.accessToken
              : ""
          }
          readOnly={true}
        ></textarea>
        <button
          onClick={() => {
            auth.destroy();
            setState(() => {
              return {};
            });
          }}
        >
          Clear local JWT
        </button>
        <p style={{ textAlign: "left" }}>
          {state.supportedServices.map((service) => {
            return (
              <button
                key={service.slug}
                className="service-button"
                onClick={async () => {
                  await auth.login(service.slug);
                  const isLoggedIn = await auth.isLoggedIn(service.slug);
                  setState((oldState) => {
                    return { ...oldState, [service.slug]: isLoggedIn };
                  });
                }}
              >
                {!!state[service.slug] ? " ✓" : ""}{" "}
                <p className="service-button-name">
                  {service.friendlyServiceName}
                </p>
              </button>
            );
          })}
        </p>
      </header>
    </div>
  );
}

export default App;
