import OpenAI from 'openai';
import {
  Instance,
  EmbeddedInstance,
  EmbeddedTextInstance,
  EmbeddedImageInstance,
  EmbeddedSketchInstance,
  EmbeddedTableInstance
} from './types';

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.WXT_OPENROUTER_KEY,
    dangerouslyAllowBrowser: true
});
export async function parseLogWithAgent(
    selectedLogs: string[],
    htmlContexts: Record<string, string>,
    previousCodeContexts: string[]
): Promise<{
    summary: string;
    code: string;
}> {
    try {
        console.log(htmlContexts)
        // Extract all unique URLs from selected logs
        const urlRegex = /\bhttps?:\/\/[^\s'"<>]+\b/gi;
        const seenUrls = new Set<string>();
        const uniqueHtmlContexts: { [url: string]: string } = {};

        selectedLogs.forEach(log => {
            const urls = log.match(urlRegex) || [];
            urls.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    const html = htmlContexts[url];
                    if (html) {
                        uniqueHtmlContexts[url] = html;
                    }
                }
            });
        });

        // Join logs and previous contexts into strings
        const logsText = selectedLogs.join('\n');
        const previousCodeText = previousCodeContexts.length
            ? previousCodeContexts.join('\n\n')
            : 'None';

        // Construct prompt with HTML and code context
        const prompt = `
You are an AI assistant tasked with analyzing operation logs from the user, and generating both a concise summary of the inferred user's intent and a corresponding Python implementation. The operation logs serve as example demonstrations of the user's desired tasks.

Your task:
1. Analyze the following operation logs and extract the main intent or pattern.
2. Use the provided HTML contexts for any URLs mentioned in the logs.
3. Refer to previous code contexts to maintain consistency and avoid duplication. 
4. Generate a Python script that programmatically represents the logic described in the logs.

Return your response strictly as a JSON object in the following format:
{
  "summary": "The user's intent behind the demonstrated operations inferred by you.",
  "code": "Corresponding Python implementation."
}

Do NOT escape single quotes (') in strings.
Use double backslashes (\\\\) for special regex characters like \\s or \\d.
Do NOT include any additional text, explanations, or markdown formatting.

---

### Operation Logs:
${logsText}

---

### HTML Contexts (for URLs referenced above):
${Object.entries(uniqueHtmlContexts).map(([url, html]) =>
            `URL: ${url}\nHTML:\n\`\`\`html\n${html.slice(0, 500)}\n\`\`\``).join('\n\n')}

---

### Previous Code Contexts:
${previousCodeText}

---

### Example Input:
Operation Logs:
"Visited https://example.com"
"Clicked on 'Submit' button"
"Filled form with name 'John Doe'"

HTML Contexts:
URL: https://example.com
HTML:
\`\`\`html
<form id="myForm">
  <input type="text" name="name" />
  <button type="submit">Submit</button>
</form>
\`\`\`

Previous Code Contexts:
None

Expected Output:
{
  "summary": "Automate form submission on https://example.com with name 'John Doe'.",
  "code": "from selenium import webdriver\n\n# Initialize browser\nbrowser = webdriver.Chrome()\n\n# Visit page\nbrowser.get('https://example.com')\n\n# Fill form\nname_field = browser.find_element_by_name('name')\nname_field.send_keys('John Doe')\n\n# Submit form\nsubmit_button = browser.find_element_by_tag_name('button')\nsubmit_button.click()"
}
---

Now, analyze the given logs and return the JSON response.
`.trim();

        console.log('Constructed prompt for LLM:', prompt);

        // Call the LLM
        const completion = await openai.chat.completions.create({
            model: "qwen/qwen-turbo",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        // Extract content from response
        const content = completion.choices[0]?.message?.content || '';
        console.log('LLM response content:', content);

        // Parse JSON response
        const cleanContent = content
            .replace(/^```json\s*/, '')  // Remove markdown code blocks
            .replace(/```$/, '')
            .trim();

        const sanitizedContent = sanitizeJSONString(cleanContent);

        let parsed;
        try {
            parsed = JSON.parse(sanitizedContent);
        } catch (e) {
            console.error('Failed to parse LLM response:', sanitizedContent);
            return {
                summary: 'Error: Invalid JSON response.',
                code: '# Error: Failed to parse response'
            };
        }

        // Return structured result
        return {
            summary: parsed.summary || 'Summary not provided by LLM.',
            code: parsed.code || '# Code not provided by LLM.'
        };
    } catch (error) {
        console.error('Error calling LLM:', error);
        return {
            summary: 'Error: Failed to communicate with the LLM.',
            code: '# Error: Communication failed'
        };
    }
}

function sanitizeJSONString(jsonString: string): string {
    // Replace invalid escaped single quotes (e.g., `\'`) with plain quotes (`'`)
    let sanitized = jsonString.replace(/\\'/g, "'");

    // Replace escaped spaces (`\s`) with actual spaces
    sanitized = sanitized.replace(/\\s/g, ' ');

    return sanitized;
}