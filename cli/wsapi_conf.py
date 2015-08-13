"""
This checks the cinder.conf file to find errors in the configuration of 3PAR
arrays.

Requires the python hp3parclient: sudo pip install hp3parclient
Assumes the volume_driver is correctly set
"""
import ConfigParser



from oslo_utils import importutils
import testclient
hp3parclient = importutils.try_import("hp3parclient")
if hp3parclient:
    from hp3parclient import client as hpclient
    from hp3parclient import exceptions as hpexceptions
else:
    raise ImportError('hp3parclient package is not installed')


parser = ConfigParser.SafeConfigParser()


class WSChecker(object):
    """
    Tests web service api configurations by section in the cinder.conf file
    """
    def __init__(self, test=False, conf='/etc/cinder/cinder.conf'):
        """
        :param test: use testing client
        :param conf: location of cinder.conf
        """
        self.is_test = test
        self.conf = conf


        # This should be set based on where SSHClient copies/location of
        # test version. Read from cli.conf?  cli.conf read here or values
        # received from caller?
        parser.read(self.conf)
        self.hp3pars = []
        for section in parser.sections():
            if parser.has_option(section, 'volume_driver') \
                    and 'hp_3par' in parser.get(section, 'volume_driver'):
                self.hp3pars.append(section)

    def check_all(self):
        """
        tests configuration settings for all 3par arrays
        :return: a list of dictionaries
        """
        all_tests = []
        for section_name in self.hp3pars:
            all_tests.append(self.check_section(section_name))
        return all_tests

    def check_section(self, section_name):
        """
        Runs all WS configuration tests for a section
        If url/credentials are wrong, no further tests run and values are "unknown"
        :param section_name: from cinder.conf as [SECTION_NAME]
        :return: a dictionary - each property is pass/fail/unknown
        """
        tests = {"name": section_name,
                 "url": "unknown",
                 "credentials": "unknown",
                 "cpg": "unknown",
                 "iscsi": "unknown",
                 }
        if section_name in self.hp3pars:
            client = get_client(section_name, self.is_test)
            if client:
                tests["url"] = "pass"
                if cred_is_valid(section_name, client):
                    tests["credentials"] = "pass"
                    if cpg_is_valid(section_name, client):
                        tests["cpg"] = "pass"
                    else:
                        tests["cpg"] = "fail"
                    if iscsi_is_valid(section_name, client):
                        tests["iscsi"] = "pass"
                    else:
                        tests["iscsi"] = "fail"
                    client.logout()
                else:
                    tests["credentials"] = "fail"

            else:
                tests["url"] = "fail"
        else:
            raise ValueError('%s not found in %s' % (section_name, self.conf))
        return tests


# Config testing methods check if option values are valid
def get_client(section_name, test):
    """
    This tries to create a client and verifies the api url
    :return: The client if url is valid, None if invalid/missing
    """
    try:
        if test:
            cl = testclient.HP3ParClient(parser.get(section_name,
                                                     'hp3par_api_url'))
        else:
            cl = hpclient.HP3ParClient(parser.get(section_name,
                                                 'hp3par_api_url'))

        return cl
    except (hpexceptions.UnsupportedVersion, hpexceptions.HTTPBadRequest,
            ConfigParser.NoOptionError):
        return None


def cred_is_valid(section_name, client):
    """
    This tries to login to the client to verify credentials
    :return: True if credentials are valid, False if invalid/missing
    """
    try:
        client.login(parser.get(section_name, 'hp3par_username'),
                     parser.get(section_name, 'hp3par_password'))
        return True
    except (hpexceptions.HTTPForbidden,
            hpexceptions.HTTPUnauthorized,
            ConfigParser.NoOptionError):
        return False


def cpg_is_valid(section_name, client):
    """
    This tests to see if a cpg exists on the 3PAR array to verify cpg name
    :return: True if cpg name is valid, False if invalid/missing
    """
    cpg_list = parser.get(section_name, 'hp3par_cpg').split(',')
    for cpg in cpg_list:
        try:
            client.getCPG(cpg.strip())
        except (hpexceptions.HTTPNotFound, ConfigParser.NoOptionError):
            return False
    return True


def iscsi_is_valid(section_name, client):
    """
    This gets the iSCSI target ports from the client and checks the provided
    iSCSI IPs.
    :return: False if any of the provided IPs are wrong
    """
    valid_ips = []
    try:
        ip_list = parser.get(section_name, 'hp3par_iscsi_ips').split(",")
    except ConfigParser.NoOptionError:
        return False
    for port in client.getPorts()['members']:
        if (port['mode'] == client.PORT_MODE_TARGET and
                port['linkState'] == client.PORT_STATE_READY and
                port['protocol'] == client.PORT_PROTO_ISCSI):
            valid_ips.append(port['IPAddr'])
    for ip_addr in ip_list:
        ip = ip_addr.strip().split(':')
        if ip[0] not in valid_ips:
            return False
    return True
