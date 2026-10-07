/* Real visitors never see or fill the hidden "website" field. Bots that do get a fake success. */
function honeypot(req, res, next) {
  if (req.body && req.body.website) return res.json({ ok: true });
  next();
}

module.exports = honeypot;
