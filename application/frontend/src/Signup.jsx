import "./App.css";
import "./Auth.css";
import { useState } from 'react';
import { useNavigate } from "react-router-dom";


// Help button for dummies
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

// Signup page

function Signup() {
  const navigate = useNavigate();

  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  function validate() {
    const newErrors = {};

    if (!id.trim()) {
      newErrors.id = "Student ID is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!confirmEmail.trim()) {
      newErrors.confirmEmail = "Please confirm your email address.";
    } else if (
      confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()
    ) {
      newErrors.confirmEmail = "Email addresses do not match.";
    }
    
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: id,
          institutionalEmail: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account activation failed.");
      }

      setServerMessage(
        `Account activated successfully. Your student ID is ${data.user.displayId}.`
      );

      setTimeout(() => {
        navigate("/login");
      }, 2500);


    } catch (error) {
      setServerMessage(error.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="login-card">
        <h1>Sign Up</h1>
        <div className="account-approval-notice">
          <div className="label-container">
            <span className="label-text">
              Account Approval Required
            </span>

            <HelpTooltip
              label="Account approval information"
              text="Your institutional email must be approved by a BBEdu or school administrator before you can create an account."
            />
          </div>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="label-container">
            <label className="label-text" htmlFor="identifier">
              Institutional ID
            </label>

            <HelpTooltip
              label="Institutional ID information"
              text="Use the ID associated with your student or administrator status in your organization."
            />
          </div>

          <input
            id="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="e.g. 123456789"
          />

          {errors.id && (
            <p className="form-error">{errors.id}</p>
          )}

          <div className="label-container">
            <label className="label-text" htmlFor="identifier">
              E-mail
            </label>

            <HelpTooltip
              label="School email information"
              text="Use the school email address associated with your student or administrator account."
            />
          </div>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. student@sfsu.edu"
            autoComplete="email"
          />

          {errors.email && (
            <p className="form-error">{errors.email}</p>
          )}


          <label htmlFor="confirmEmail">Confirm School E-mail</label>

          <input
            id="confirmEmail"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter your school email again"
            autoComplete="email"
          />

          {errors.confirmEmail && (
            <p className="form-error">{errors.confirmEmail}</p>
          )}


          <label className="label-text" htmlFor="identifier">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />

          {errors.password && (
            <p className="form-error">{errors.password}</p>
          )}

          <button
            type="submit"
            className="auth-submit-button"
            disabled={submitting}
          >
            {submitting ? "Activating account..." : "Sign Up"}
          </button>
        </form>

        {serverMessage && <p>{serverMessage}</p>}
      </div>
    </main>
  );
}

export default Signup;
