import { useId, useState } from "react";

const FAQ_ITEMS = [
  {
    question: "Does OneTap read my inbox or train on my data?",
    answer:
      "No. OneTap processes the job descriptions you submit and the emails it drafts on your behalf. It does not read unrelated Gmail threads, sell your data, or train models on your résumé. API keys are encrypted at rest and used only to run your requests.",
  },
  {
    question: "How does sending from Gmail work?",
    answer:
      "You connect your Gmail account once in setup. Applications send from your real inbox so recruiters see your name and email address, not a platform no-reply address. You can review each email first or turn on Auto apply to send automatically.",
  },
  {
    question: "Can I review emails before they go out?",
    answer:
      "Yes. Turn Auto apply off to draft each email, edit the subject and body, and send when you are ready. Turn it on when you want OneTap to send automatically from Gmail after you add a role.",
  },
  {
    question: "Do I need the Chrome extension?",
    answer:
      "No. You can paste any job description into the Apply tab. The Chrome extension is optional: it lets you apply in one click from LinkedIn without copy-pasting.",
  },
  {
    question: "What do I need to get started?",
    answer:
      "Create your account, choose a plan, and complete a short setup: upload your résumé and connect Gmail. On Bring your own AI, you also add an API key from a supported provider. On OneTap AI, hosted models are included with no key setup.",
  },
  {
    question: "How does billing work?",
    answer:
      "Subscriptions are billed monthly when you choose a plan. Payments are processed securely through our checkout partner. On Bring your own AI, you also pay your AI provider directly for token usage.",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Yes. Payments are handled by our checkout partner. OneTap never stores your card, UPI, or bank details on our servers.",
  },
  {
    question: "What AI providers can I connect?",
    answer:
      "On Bring your own AI, connect OpenAI, Gemini, Groq, or OpenRouter and pick from certified models for that provider. On OneTap AI, applications run on OneTap-hosted models with no provider account required.",
  },
] as const;

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  const answerId = useId();

  return (
    <div className={`m-faq-item${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="m-faq-question"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen((current) => !current)}
      >
        {question}
      </button>
      <div id={answerId} className="m-faq-answer-body" aria-hidden={!open}>
        <div className="m-faq-answer-inner">
          <p className="m-faq-answer m-body-text">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function MindooFaqSection() {
  return (
    <section id="faq" className="m-section m-faq">
      <div className="m-padding-global">
        <div className="m-container">
          <h2 data-reveal="" className="m-h3 m-faq-title">
            Common questions
          </h2>

          <div data-reveal="" className="m-faq-list">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
