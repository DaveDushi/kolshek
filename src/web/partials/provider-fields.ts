// Dynamic login fields partial — returned by GET /api/providers/fields/:companyId
// Renders the correct input fields based on the provider's loginFields.

import { PROVIDERS, isValidCompanyId } from "../../types/provider.js";
import { getProvidersByCompanyId } from "../../db/repositories/providers.js";

export function providerLoginFields(companyId: string): string {
  if (!isValidCompanyId(companyId)) {
    return `<p class="text-muted">Unknown provider.</p>`;
  }

  const info = PROVIDERS[companyId];
  const existingInstances = getProvidersByCompanyId(companyId);

  let aliasField = "";
  if (existingInstances.length > 0) {
    const existing = existingInstances.map((p) => p.alias).join(", ");
    aliasField = `
      <label>
        Alias <small class="text-muted">(existing: ${existing})</small>
        <input type="text" name="alias" required placeholder="e.g. leumi-joint" pattern="[a-zA-Z0-9_-]+">
      </label>`;
  }

  const fields = info.loginFields
    .map((field) => {
      const isPassword = field === "password" || field === "otpLongTermToken";
      const inputType = isPassword ? "password" : "text";
      const required = field === "otpLongTermToken" ? "" : " required";
      const placeholder = field === "otpLongTermToken" ? "Leave empty if not available" : "";
      return `
      <label>
        ${fieldLabel(field)}
        <input type="${inputType}" name="cred_${field}" autocomplete="off"${required}${placeholder ? ` placeholder="${placeholder}"` : ""}>
      </label>`;
    })
    .join("\n");

  return `${aliasField}${fields}
    <input type="hidden" name="companyId" value="${companyId}">
    <button type="submit" hx-disabled-elt="this">Add Provider</button>`;
}

export function providerAuthFields(companyId: string, providerId: number): string {
  if (!isValidCompanyId(companyId)) {
    return `<p class="text-muted">Unknown provider.</p>`;
  }

  const info = PROVIDERS[companyId];

  const fields = info.loginFields
    .map((field) => {
      const isPassword = field === "password" || field === "otpLongTermToken";
      const inputType = isPassword ? "password" : "text";
      const required = field === "otpLongTermToken" ? "" : " required";
      const placeholder = field === "otpLongTermToken" ? "Leave empty if not available" : "";
      return `
      <label>
        ${fieldLabel(field)}
        <input type="${inputType}" name="cred_${field}" autocomplete="off"${required}${placeholder ? ` placeholder="${placeholder}"` : ""}>
      </label>`;
    })
    .join("\n");

  return `<article>
    <form hx-post="/api/providers/${providerId}/auth" hx-target="#auth-form-container" hx-swap="innerHTML">
      <h4>Update Credentials</h4>
      ${fields}
      <div class="grid">
        <button type="submit" hx-disabled-elt="this">Save</button>
        <button type="button" class="secondary outline" onclick="document.getElementById('auth-form-container').innerHTML=''">Cancel</button>
      </div>
    </form>
  </article>`;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    username: "Username",
    userCode: "User Code",
    password: "Password",
    id: "ID Number",
    num: "Branch/Account Number",
    card6Digits: "Last 6 Digits of Card",
    email: "Email",
    nationalID: "National ID",
    otpLongTermToken: "OTP Long-Term Token",
  };
  return labels[field] ?? field;
}
