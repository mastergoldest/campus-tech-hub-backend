import { z } from "zod";
import transporter from "../config/email.js";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export const sendContactMessage = async (req, res) => {
  try {
    // Validate submitted information.
    const validation = contactSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid contact information.",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { name, email, subject, message } = validation.data;

    // Escape user-provided content before inserting it into HTML.
    const safeName = escapeHTML(name);
    const safeEmail = escapeHTML(email);
    const safeSubject = escapeHTML(subject);
    const safeMessage = escapeHTML(message).replace(/\n/g, "<br>");

    // Send the message to the platform email.
    await transporter.sendMail({
      from: `"Campus Tech Hub Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Contact Form: ${subject}`,

      text: `
New Contact Form Message

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,

      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7;">
          <h2>New Campus Tech Hub Contact Message</h2>

          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>

          <h3>Message</h3>
          <p>${safeMessage}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Your message has been sent successfully.",
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send your message at the moment. Please try again later.",
    });
  }
};