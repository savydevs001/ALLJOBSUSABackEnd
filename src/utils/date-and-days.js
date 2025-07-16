function getDateNDaysFromNow(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

export default getDateNDaysFromNow;
