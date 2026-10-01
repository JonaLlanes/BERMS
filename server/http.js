function describeError(error) {
  if (error && Array.isArray(error.errors) && error.errors.length) {
    const details = error.errors.map((item) => item.message).filter(Boolean);
    if (details.length) return details.join('; ');
  }
  return error.message || error.code || 'Unknown database error';
}

function sendDbError(res, error) {
  if (error.code === 'ER_DUP_ENTRY') {
    const message = String(error.sqlMessage || '');
    const errors = {};
    if (message.includes('asset_tag')) {
      errors.asset_tag = 'A device with this asset tag already exists.';
    } else if (message.includes('serial_number')) {
      errors.serial_number = 'A device with this serial number already exists.';
    } else {
      errors.form = 'This record duplicates an existing asset tag or serial number.';
    }
    return res.status(409).json({ errors });
  }

  if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_DB_ERROR') {
    return res.status(500).json({
      errors: { form: 'Database is not set up. Run npm run setup, then start the app again.' }
    });
  }

  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ER_ACCESS_DENIED_ERROR' ||
    error.code === 'PROTOCOL_CONNECTION_LOST' ||
    error.code === 'ENOTFOUND'
  ) {
    return res.status(500).json({
      errors: { form: 'Could not connect to MySQL. Check the settings in .env.' }
    });
  }

  console.error(describeError(error));
  return res.status(500).json({
    errors: { form: 'The database request failed. Check MySQL and try again.' }
  });
}

function parseId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

function likeTerm(value) {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

module.exports = {
  sendDbError,
  parseId,
  likeTerm
};
