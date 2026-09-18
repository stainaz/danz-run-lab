const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function subscribe(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Use POST to subscribe." });
  }

  let body = request.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ message: "Enter a valid email address." });
    }
  }

  if (body.website) return response.status(200).json({ message: "You're in. Run Weekly will land in your inbox." });

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return response.status(400).json({ message: "Enter a valid email address." });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!apiKey || !groupId) {
    return response.status(503).json({
      code: "newsletter_not_configured",
      message: "Run Weekly subscriptions are not live yet. MailerLite still needs to be connected.",
    });
  }

  try {
    const providerResponse = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, groups: [groupId] }),
    });

    if (!providerResponse.ok) {
      console.error("MailerLite subscription failed", providerResponse.status);
      return response.status(502).json({ message: "We couldn't add you right now. Please try again shortly." });
    }

    return response.status(200).json({ message: "You're in. Run Weekly will land in your inbox." });
  } catch (error) {
    console.error("MailerLite subscription request failed", error instanceof Error ? error.message : "Unknown error");
    return response.status(502).json({ message: "We couldn't add you right now. Please try again shortly." });
  }
};
