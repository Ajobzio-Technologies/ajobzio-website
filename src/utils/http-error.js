/* An error whose message is safe to show the visitor, with the HTTP status to send.
   Pass { cause } to keep the underlying error for the server log. */
class HttpError extends Error {
  constructor(status, message, options) {
    super(message, options);
    this.status = status;
  }
}

module.exports = HttpError;
