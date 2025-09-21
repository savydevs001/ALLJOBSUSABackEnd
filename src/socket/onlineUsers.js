const onlineUsers = new Map();

function refreshOnlineUser(userId, socketId) {
  try {
    // Clear existing timeout if present
    // if (onlineUsers.has(userId)) {
    //   clearTimeout(onlineUsers.get(userId).timeout);
    // }

    // // Generate a random interval between 1 and 10 minutes
    // const randomMinutes = Math.floor(Math.random() * 10) + 1;
    // const ms = randomMinutes * 60 * 1000;

    // const timeout = setTimeout(() => {
    //   // If no refresh, remove user after timeout
    //   onlineUsers.delete(userId);
    // }, ms);

    // Store or update
    if (!checkOnlineUser(userId)) {
      onlineUsers.set(userId, { socketId });
    }
  } catch (err) {
    //
  }
}

function deleteOnlineUser(userId) {
  onlineUsers.delete(userId);
}

function checkOnlineUser(userId) {
  return onlineUsers.has(userId);
}

function getOnlineUser(userId) {
  return onlineUsers.get(userId);
}

export { refreshOnlineUser, deleteOnlineUser, checkOnlineUser, getOnlineUser };
