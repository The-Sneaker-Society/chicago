export const isAuthorizedToViewMessages = (dbUser, memberId, userId) => {
  // Create an array of allowed user ID strings by converting ObjectIds to strings
  const allowedUserIdStrings = [memberId.toString(), userId.toString()];

  // Check if the string representation of the current user's ID (dbUser._id)
  // is included in the array of allowed ID strings.
  // Return true if authorized, false otherwise.
  return !allowedUserIdStrings.includes(dbUser._id.toString());
};
