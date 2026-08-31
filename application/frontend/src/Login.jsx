import "./App.css";
import "./Auth.css";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeSession } from "./AuthContext.jsx";

function HelpTooltip({ text, label = "More information" }) {
  return (
    <span className="help-tooltip">
      <button
        type="button"
        className="help-tooltip-button"
        aria-label={label}
      >
        ?
      </button>

      <span className="help-tooltip-text" role="tooltip">
        {text}
      </span>
    </span>
  );
}

// Login page

function Login() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  function validate() {
    const newErrors = {};

    if (!identifier.trim()) {
      newErrors.identifier = "E-mail is required.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    return newErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerMessage("");

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      //Send login credentials to the Express backend.
      //The backend route is defined in server.js as POST /api/auth/login.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier,
          password: password,
        }),
      });

      const data = await response.json();

      //If login fails, the backend returns an error message.
      //Example: invalid email/password or database issue.
      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      storeSession(data.token, data.user);

      setServerMessage(
        `Login successful. Welcome ${data.user.firstName} ${data.user.lastName}.`
      );

      // Swapped to navigation format
      // Check if the user is an admin and navigate accordingly
      if (data.user.role === "admin") {
        navigate("/admin");
      }
      else {
        navigate("/student-portal");
      }


    } catch (err) {
      setServerMessage(err.message || "An error occurred while logging in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="login-card">
        <h1>Login</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="login-label-row">
            <div className="label-container">
              <label className="label-text" htmlFor="identifier">
                E-mail
              </label>

              <HelpTooltip
                label="School email information"
                text="Use the school email address associated with your student or administrator account."
              />
            </div>
          </div>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. student@sfsu.edu"
          />
          {errors.identifier && (
            <p className="form-error">{errors.identifier}</p>
          )}

          <label className="label-text" htmlFor="identifier">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="e.g. demostudent"
          />
          {errors.password && <p className="form-error">{errors.password}</p>}


          <button
            type="submit"
            className="auth-submit-button"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>

        {serverMessage && <p>{serverMessage}</p>}

      </div>
    </main>
  );
}

export default Login;
