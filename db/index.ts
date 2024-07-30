import type * as pg from 'pg';
import fccdefs from './fccdefs.js';

let _pool: pg.Pool | undefined;

interface AmateurLicense {
    readonly id: string
    readonly statusCode: string
    get status(): string
    readonly grantDateRaw: string
    get grantDate(): Date
    readonly expireDateRaw: string
    get expireDate(): Date
    readonly cancelDateRaw: string
    get cancelDate(): Date
    readonly effectiveDateRaw: string
    get effectiveDate(): Date
    readonly lastActionDateRaw: string
    get lastActionDate(): Date

    readonly entityType: string
    readonly entityName: string
    readonly firstName: string
    readonly middleInitial: string
    readonly lastName: string
    readonly suffix: string
    get name(): string

    readonly streetAddress: string
    readonly city: string
    readonly state: string
    readonly zipRaw: string
    get zip(): string
    readonly poBox: string
    readonly attentionLineRaw: string | undefined
    get attentionLine(): string
    readonly frn: string
    readonly applicantTypeCode: string
    get applicantType(): string

    readonly callsignAscii: string
    get callsign(): string
    readonly operatorClassCode: string
    get operatorClass(): string
    readonly trusteeCallsign: string | undefined
    readonly trusteeName: string | undefined
}

export async function licenseByCallsign(callsign: string): Promise<AmateurLicense | null> {
    const result = await _pool.query(`SELECT unique_system_identifier, license_status,
    grant_date, expired_date, cancellation_date, effective_date, last_action_date,
    entity_type, entity_name, first_name, mi, last_name, suffix,
    street_address, city, state, zip_code, po_box, attention_line, frn, applicant_type_code,
    callsign, operator_class, trustee_callsign, trustee_name
    from l_HD JOIN l_EN USING(unique_system_identifier) JOIN l_AM using(unique_system_identifier)
    where l_HD.call_sign = $1::text ORDER BY to_date(effective_date, 'MM/DD/YYYY') DESC LIMIT 1;`, [callsign.trim().toUpperCase()]);

    const [record] = result.rows;

    if (!record)
        return null;

    return {
        id: record.unique_system_identifier,
        statusCode: record.license_status,
        get status() {
            return fccdefs.licenseStatus(this.statusCode);
        },
        grantDateRaw: record.grant_date,
        get grantDate() {
            return new Date(this.grantDateRaw);
        },
        expireDateRaw: record.expired_date,
        get expireDate() {
            return new Date(this.expireDateRaw);
        },
        cancelDateRaw: record.cancellation_date,
        get cancelDate() {
            return new Date(this.cancelDateRaw);
        },
        effectiveDateRaw: record.effective_date,
        get effectiveDate() {
            return new Date(this.effectiveDateRaw);
        },
        lastActionDateRaw: record.last_action_date,
        get lastActionDate() {
            return new Date(this.lastActionDateRaw);
        },

        entityType: record.entity_type,
        entityName: record.entity_name,
        firstName: record.first_name,
        middleInitial: record.mi,
        lastName: record.last_name,
        suffix: record.suffix,
        get name() {
            return [this.firstName, this.middleInitial, this.lastName, this.suffix].filter(e => e).join(' ') || this.entityName;
        },

        streetAddress: record.street_address,
        city: record.city,
        state: record.state,
        zipRaw: record.zip_code,
        get zip() {
            const zip = this.zipRaw;

            if (zip && zip.trim().length > 5)
                return `${zip.slice(0, 5)}-${zip.slice(5)}`;

            return zip;
        },
        poBox: record.po_box,
        attentionLineRaw: record.attention_line,
        get attentionLine(): string {
            return this.attentionLineRaw && `ATTN: ${this.attentionLineRaw}`;
        },
        frn: record.frn,
        applicantTypeCode: record.applicant_type_code,
        get applicantType() {
            return fccdefs.applicantType(this.applicantTypeCode);
        },

        callsignAscii: record.callsign.trim(),
        get callsign() {
            return this.callsignAscii.replace('0', '\u00d8');
        },
        operatorClassCode: record.operator_class,
        get operatorClass() {
            return fccdefs.operatorClass(this.operatorClassCode);
        },
        trusteeCallsign: record.trustee_callsign,
        trusteeName: record.trustee_name
    };
}

interface IncrementalUpdate {
    day: string,
    timestamp: Date
}

interface DatabaseStatus {
    name: "Application" | "License"
    lastFullUpdate: Date
    incrementalUpdatesApplied: IncrementalUpdate[]
    realTimeFetchesApplied: number
    latestRealTimeFetch: Date | null
}

interface SystemStatus {
    latency: number,
    fetchStatus: DatabaseStatus[]
}

export async function status(): Promise<SystemStatus | null> {
    // get the cold latency
    const start_ts = Date.now();
    await licenseByCallsign('W0EEE');
    const end_ts = Date.now();
    const latency = end_ts - start_ts;

    const complete = await _pool.query(`SELECT DISTINCT ON (db_name) * FROM db_updates WHERE update_type = 'COMPLETE' ORDER BY db_name, ts DESC;`);

    const [app_complete, lic_complete] = complete.rows;

    const [app_incremental, lic_incremental] = await Promise.all([
        _pool.query(`SELECT * FROM db_updates WHERE update_type = 'INCREMENTAL' AND db_name = 'APPLICATION' AND ts > TO_TIMESTAMP($1) ORDER BY ts DESC;`, [app_complete.ts.valueOf()/1000]),
        _pool.query(`SELECT * FROM db_updates WHERE update_type = 'INCREMENTAL' AND db_name = 'LICENSE' AND ts > TO_TIMESTAMP($1) ORDER BY ts DESC;`, [lic_complete.ts.valueOf()/1000])
    ]);

    const application_status: DatabaseStatus = {
        name: "Application",
        lastFullUpdate: app_complete.ts,
        incrementalUpdatesApplied: app_incremental.rows.map(r => { return { day: r.incremental_day, timestamp: r.ts }; }),
        realTimeFetchesApplied: 0,
        latestRealTimeFetch: null
    };

    const license_status: DatabaseStatus = {
        name: "License",
        lastFullUpdate: lic_complete.ts,
        incrementalUpdatesApplied: lic_incremental.rows.map(r => { return { day: r.incremental_day, timestamp: r.ts }; }),
        realTimeFetchesApplied: 0,
        latestRealTimeFetch: null
    };

    return { latency, fetchStatus: [application_status, license_status] };
}

export function _setPool(pool: pg.Pool) {
    _pool = pool;
}

export default {
    licenseByCallsign,
    status
};
