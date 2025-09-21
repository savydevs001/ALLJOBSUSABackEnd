const abortSessionWithMessage = async (res, session, message, code = 400) => {
  try {
    await session.abortTransaction();
    session.endSession();
    return res.status(code).json({ message });
  } catch (err) {
    throw err;
  }
};

export default abortSessionWithMessage;
