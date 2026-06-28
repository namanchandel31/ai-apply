import { useId, useState } from "react";

const FAQ_ITEMS = [
  {
    question: "What is OneTap?",
    answer:
      "OneTap helps you apply to jobs faster. Instead of rewriting the same application over and over, just paste a job description or use the Chrome extension. OneTap writes a tailored application, sends it from your Gmail, and keeps everything organized in one place.",
  },
  {
    question: "How does OneTap work?",
    answer:
      "Once you add a job description, OneTap compares it with your résumé to understand how well you match the role. It then writes a personalized application, sends it from your Gmail, and automatically tracks it for you.",
  },
  {
    question: "Does OneTap have access to my Gmail?",
    answer:
      "No. OneTap cannot read your inbox, emails, or conversations. It only uses the permission you grant to send job applications from your Gmail on your behalf.",
  },
  {
    question: "Do I need the Chrome extension?",
    answer:
      "No. You can paste any job description directly into OneTap. The Chrome extension is optional and lets you apply from LinkedIn in one click.",
  },
  {
    question: "Can I review applications before they're sent?",
    answer:
      "Yes. You can review and edit every application before sending it. If you'd rather automate everything, you can turn on Auto Apply and let OneTap send applications for you.",
  },
  {
    question: "Do I need my own AI API key?",
    answer:
      "Not unless you want to. You can connect your own AI provider and pay only for what you use, or use OneTap's managed AI with no API key or setup required.",
  },
  {
    question: "How do I track my applications?",
    answer:
      "Every application is automatically saved in your dashboard. You can see where you've applied, track the status, and keep your entire job search organized in one place.",
  },
  {
    question: "Can I use OneTap without LinkedIn?",
    answer:
      "Yes. OneTap works with any job description. You can paste a job posting from any website, or use the Chrome extension to apply directly from LinkedIn.",
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
