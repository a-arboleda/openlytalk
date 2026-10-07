// New data expires early enough for the daily cleanup to run before the public
// seven-day maximum, including Hobby's scheduling delay. Existing expiries stay.
export const SESSION_ACCESS_DAYS = 5;
