import { BaseConnector } from '@discipl/core-baseconnector'
import { irma } from '@privacybydesign/irmajs'

import * as log from 'loglevel'

/**
 * Example code using irmajs library by privacy by design Foundation
 */
function doIssuanceSession() {
    const attrs = ["892.5", "Sanne Voorspoed", "1050"];
    doSession({
        '@context': 'https://irma.app/ld/request/issuance/v2',
        'credentials': [{
            'credential': 'irma-demo.discipl.demoBVV',
            'attributes': { 'calculatedBVV': attrs[0], 'debtCollector': attrs[1], 'incomeUsedForBVV': attrs[2] }
        }]
    }).then(function (result) { showSuccess('Success'); });
}

function doSession(request) {
    clearOutput();
    showSuccess('Issuance running...');

    const server = 'http://localhost:8088';
    const authmethod = "none";
    const key = "";
    const requestorname = "";

    return irma.startSession(server, request, authmethod, key, requestorname)
        .then(function (pkg) { return irma.handleSession(pkg.sessionPtr, { server: server, token: pkg.token, method: 'popup', language: 'en' }); })
        .then(function (result) {
            console.log('Done', result);
            return result;
        })
        .catch(function (err) { showError(err); });
}

// UI handling functions
function clearOutput() {
    const e = document.getElementById('result');
    e.setAttribute('hidden', 'true');
    e.classList.remove('succes', 'warning', 'error');
}

function showError(err) {
    const e = document.getElementById('result');
    e.removeAttribute('hidden');
    e.classList.remove('success');
    if (err === irma.SessionStatus.Cancelled) {
        e.classList.add('warning');
        e.innerText = 'Session was cancelled';
    } else {
        e.classList.add('error');
        e.innerText = 'Error occurred: ' + String(err);
    }
    throw err;
}

function showSuccess(text) {
    const e = document.getElementById('result');
    e.innerHTML = text;
    e.removeAttribute('hidden');
    e.classList.add('Success');
}


class IRMAConnector extends BaseConnector {

    constructor(props) {
        super(props)
        this.IRMAClient = IRMAClient
        this.logger = log.getLogger('IRMAConnector')
        this.logger.setLevel(loglevel)

    }

    /**
     * Configures the connector. It will connect to an instance of an IRMA server executable (daemon).
     * See: https://irma.app/docs/irma-cli/ for installation instructions and some examples
     * 
     * @param {string} serverEndpoint - IRMA server HTTP endpoint, used by the IRMA app during IRMA sessions
     * @param {string} loglevel - Loglevel of the connector. Default at 'warn'. Change to 'info','debug' or 'trace' to
     * get more information
     */
    configure(serverEndpoint, caching) {
        this.IRMAClient = new IRMAClient(serverEndpoint)
        if (caching !== undefined) {
            this.caching = caching
        }
    }

    /**
     * Returns the name of this connector.
     * 
     * @returns {string} The string 'IRMA'.
     */
    getName() {
        return 'IRMA'
    }

    /**
     * Looks up the corresponding did for a particular claim.
     * 
     * @param {string} link - Link to the claim
     * @returns {Promise<string>} Did that made this claim
     */
    async getDidOfClaim(link) {
        const reference = BaseConnector.referenceFromLink(link)
        return this.didFromReference(
            await this.IRMAClient.getPublicKey(reference)
        )
    }

    /**
     * Returns a link to the last claim made by this did
     *
     * @param {string} did
     * @returns {Promise<string>} Link to the last claim made by this did
     */
    async getLatestClaim(did) {
        return this.linkFromReference(
            await this.IRMAClient.getLatest(BaseConnector.referenceFromDid(did))
        )
    }

    /**
     * Generate a new identity
     * 
     * @returns Created identity
     */
    async newIdentity() {
        throw new Error('Method not implemented.')
    }

    /**
     * Expresses a claim
     *
     * The data will be serialized using a stable stringify that only depends on the actual data being claimed,
     * and not on the order of insertion of attributes.
     * If the exact claim has been made before, this will return the existing link, but not recreate the claim.
     *
     * @param {string} did - Identity that expresses the claim
     * @param {string} privkey - Base64 encoded authentication mechanism
     * @param {object} data - Arbitrary object that constitutes the data being claimed.
     * @param {object} [data.DISCIPL_ALLOW] - Special type of claim that manages ACL
     * @param {string} [data.DISCIPL_ALLOW.scope] - Single link. If not present, the scope is the whole channel
     * @param {string} [data.DISCIPL_ALLOW.did] - Did that is allowed access. If not present, everyone is allowed.
     * @returns {Promise<string>} link - Link to the produced claim
     */
    async claim(did, privkey, data) {
        log.info('Making a claim')
        // Sort the keys to get the same message for the same data

        const reference = BaseConnector.referenceFromDid(did)

        const identity = await this.identityFactory.fromDid(did, privkey)
        const signature = identity.sign(data)

        const claim = {
            message: data,
            signature: signature,
            publicKey: reference
        }

        return this.linkFromReference(await this.IRMAClient.claim(claim))
    }

    async get(reference, ssid = null) {
        return { 'data': '', 'previous': null }
    }

    async observe(ssid) {
        return false
    }

}

export default IRMAConnector;