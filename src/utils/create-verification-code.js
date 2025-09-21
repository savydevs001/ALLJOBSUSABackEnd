const generateVerificationCode = () => {
  const length = 6;
  const chars = "0123456789"; // or add A-Z for alphanumeric
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};
export default generateVerificationCode;
