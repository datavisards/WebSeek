# Privacy Policy for WebSeek

**Last updated:** March 19, 2026

WebSeek ("the Extension") is a browser extension developed as part of an academic research project at the Hong Kong University of Science and Technology (HKUST). This policy describes what data WebSeek accesses, how it is used, and your rights as a user.

---

## 1. Summary

WebSeek does **not** collect, store, or sell personal data to any third party. The Extension reads web page content solely to help you extract and organize information you choose to work with. All data remains on your device or is transmitted only to services you explicitly configure.

---

## 2. Data the Extension Accesses

### 2.1 Web Page Content
WebSeek reads the content of web pages you visit (text, links, structured data such as product listings or tables) when you **explicitly trigger** an extraction action. This content is:
- Used locally to populate data tables and visualizations in the side panel.
- Sent to AI APIs (see Section 3) only when you request AI-assisted extraction or analysis.
- Never stored on our servers and never transmitted without your action.

### 2.2 User-Created Data (Tables and Visualizations)
Data instances (tables, lists, visualizations) you create within WebSeek are stored **locally** in your browser using `chrome.storage` and `localStorage`. This data:
- Never leaves your device except when you explicitly export it or when it is sent to the AI backend for analysis.
- Is not accessible to the developers of WebSeek.

### 2.3 API Keys and Settings
Your API keys (e.g., OpenRouter key) and configuration preferences are stored **locally** in `localStorage` within the extension. They are:
- Never transmitted to WebSeek developers or any third party other than the API provider you configured.
- Used only to authenticate requests made on your behalf to the AI services you choose.

### 2.4 Session Snapshots (Backend)
If you use the optional backend server, session snapshots (your workspace state, including extracted tables and visualizations) may be saved to a database on the backend server for session continuity. This data:
- Is stored only on the server you configure (by default, the HKUST research server).
- Is used solely to restore your workspace across sessions.
- Is not shared with third parties.

---

## 3. Third-Party Services

WebSeek integrates with the following external services **only when you actively use AI features**:

| Service | Purpose | Data Sent | Privacy Policy |
|---|---|---|---|
| **OpenRouter** | LLM routing for AI analysis and suggestions | Web page content snippets, your prompts | [openrouter.ai/privacy](https://openrouter.ai/privacy) |
| **Google Gemini / AI Studio** | AI agent orchestration (backend) | Task descriptions, extracted data | [policies.google.com/privacy](https://policies.google.com/privacy) |

WebSeek does not control how these third-party services process data. Please review their privacy policies before use. You can use WebSeek without AI features by not configuring an API key.

---

## 4. Data We Do NOT Collect

- We do not collect names, email addresses, or any account information.
- We do not use cookies or tracking pixels.
- We do not use analytics or telemetry services.
- We do not build user profiles or behavioral models.
- We do not sell or share any data with advertisers.

---

## 5. Permissions Justification

| Permission | Why It Is Required |
|---|---|
| `sidePanel` | To display the data workspace alongside the web page you are browsing. |
| `activeTab` | To read the content of the current tab when you trigger an extraction. |
| `scripting` | To inject the content script that reads page structure for data extraction. |
| `storage` | To persist your workspace (tables, visualizations, settings) locally. |
| `tabs` | To detect navigation events and synchronize the workspace with the current page. |
| `clipboardRead` / `clipboardWrite` | To allow copy/paste of data between the extension and other applications. |
| `host_permissions: <all_urls>` | WebSeek is designed to work on any website you choose to research. Broad host access is required because the websites you analyze cannot be predicted in advance. |

---

## 6. Data Retention and Deletion

- **Local data**: All data stored in `chrome.storage` and `localStorage` is deleted when you uninstall the Extension or clear your browser data.
- **Backend snapshots**: If you use the optional backend, session data is retained on the configured server. Contact the administrator of your backend instance to request deletion.
- **Third-party services**: Data sent to OpenRouter or Google is subject to their respective retention policies.

---

## 7. Children's Privacy

WebSeek is not directed at children under 13 and does not knowingly collect data from children.

---

## 8. Changes to This Policy

We may update this policy to reflect changes in the Extension's functionality. The "Last updated" date at the top will reflect the most recent revision. Continued use of the Extension after an update constitutes acceptance of the revised policy.

---

## 9. Contact

WebSeek is developed as part of the research paper:

> **"Facilitating Proactive and Reactive Guidance for Decision Making on the Web: A Design Probe with WebSeek"**
> Yanwei Huang and Arpit Narechania
> Accepted at ACM CHI 2026
> Preprint: https://arxiv.org/abs/2601.15100

For questions or concerns about this privacy policy, contact:
**Yanwei Huang** — Hong Kong University of Science and Technology
(Please open an issue on the [GitHub repository](https://github.com/datavisards/WebSeek) for inquiries.)
