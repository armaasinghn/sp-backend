/**
 * Verify Controller — Surepass RC proxy
 * Keeps the Surepass Bearer token server-side only.
 */
const axios  = require('axios');
const { query } = require('../../../config/database');

// Basic Indian RC format: 2-letter state + 1-2 digit district +
// 0-3 letter series + 1-4 digits  e.g. DL3CAM0001 / MH01AB1234
const RC_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;

exports.verifyRC = async (req, res) => {
  const { vehicle_number } = req.body;

  if (!vehicle_number || !vehicle_number.trim()) {
    return res.status(400).json({ status: 'error', message: 'Vehicle number is required' });
  }

  const rcNumber = vehicle_number.toUpperCase().replace(/[\s\-]/g, '');

  if (!RC_PATTERN.test(rcNumber)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid vehicle registration format. Expected format: DL3CAM0001 or MH01AB1234',
    });
  }

  let statusCode = null;
  let apiSuccess = false;

  try {
    const response = await axios.post(
      `${process.env.SUREPASS_BASE_URL}/api/v1/rc/rc-full`,
      { id_number: rcNumber },
      {
        headers: {
          'Authorization': `Bearer ${process.env.SUREPASS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    statusCode = response.status;
    const body = response.data;

    // Surepass returns HTTP 200 even for backend/data failures
    if (!body?.success || body?.message_code === 'backend_down') {
      await _log(req.user?.userId, rcNumber, statusCode, false);
      const msg = body?.message_code === 'backend_down'
        ? 'RTO data source is temporarily unavailable — try another number or try again later'
        : 'No vehicle record found';
      return res.status(404).json({ status: 'error', message: msg });
    }

    const d = body?.data;
    if (!d) {
      await _log(req.user?.userId, rcNumber, statusCode, false);
      return res.status(404).json({ status: 'error', message: 'No vehicle record found' });
    }

    apiSuccess = true;
    await _log(req.user?.userId, rcNumber, statusCode, true);

    const formatted = formatRCResponse(d);
    const isBlacklisted = !!(d.blacklist_status && d.blacklist_status !== null && d.blacklist_status !== '');

    return res.json({
      status: 'success',
      blacklisted: isBlacklisted,
      warning: isBlacklisted ? 'This vehicle has a blacklist entry — proceed with caution' : null,
      data: formatted,
    });

  } catch (err) {
    statusCode = err.response?.status || 0;
    await _log(req.user?.userId, rcNumber, statusCode, false);

    if (statusCode === 422) {
      return res.status(422).json({ status: 'error', message: 'Vehicle not found in RTO database', code: 422 });
    }
    if (statusCode === 401) {
      return res.status(500).json({ status: 'error', message: 'Verification service authentication failed' });
    }
    if (statusCode === 500) {
      // Surepass returns 500 when the RTO data source for this vehicle is unavailable
      const bodyMsg = err.response?.data?.message || '';
      const friendly = bodyMsg.toLowerCase().includes('backend')
        ? 'RTO data source is temporarily unavailable — try another number or try again later'
        : 'Vehicle record could not be fetched from RTO — try again later';
      return res.status(404).json({ status: 'error', message: friendly });
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ status: 'error', message: 'Verification service timed out — try again' });
    }
    return res.status(500).json({ status: 'error', message: 'Vehicle verification failed: ' + err.message });
  }
};

function formatRCResponse(d) {
  return {
    rc_number:          d.rc_number          || '',
    owner_name:         d.owner_name         || '',
    father_name:        d.father_name        || '',
    maker:              d.maker_description  || '',
    model:              d.maker_model        || '',
    body_type:          d.body_type          || '',
    vehicle_category:   d.vehicle_category_description || '',
    fuel_type:          d.fuel_type          || '',
    color:              d.color              || '',
    registration_date:  d.registration_date  || '',
    fitness_upto:       d.fit_up_to          || '',
    insurance_company:  d.insurance_company  || '',
    insurance_policy:   d.insurance_policy_number || '',
    insurance_upto:     d.insurance_upto     || '',
    manufactured:       d.manufacturing_date_formatted || d.manufacturing_date || '',
    chassis_number:     d.vehicle_chasi_number || '',
    engine_number:      d.vehicle_engine_number || '',
    emission_norms:     d.norms_type         || '',
    cubic_capacity:     d.cubic_capacity     || '',
    seat_capacity:      d.seat_capacity      || '',
    financer:           d.financer           || '',
    rc_status:          d.rc_status          || '',
    blacklist_status:   d.blacklist_status   || null,
    tax_upto:           d.tax_upto           || '',
    pucc_upto:          d.pucc_upto          || '',
    // Computed validity
    insurance_valid:    _isDateValid(d.insurance_upto),
    fitness_valid:      _isDateValid(d.fit_up_to),
    pucc_valid:         _isDateValid(d.pucc_upto),
  };
}

function _isDateValid(dateStr) {
  if (!dateStr || dateStr === '1800-01-01') return null;
  try { return new Date(dateStr) >= new Date(); } catch { return null; }
}

async function _log(userId, rcNumber, statusCode, success) {
  try {
    await query(
      `INSERT INTO surepass_api_logs (user_id, api_name, input, status_code, success)
       VALUES ($1, 'rc-full', $2, $3, $4)`,
      [userId || null, rcNumber, statusCode, success]
    );
  } catch (_) { /* non-blocking — never fail on log error */ }
}
