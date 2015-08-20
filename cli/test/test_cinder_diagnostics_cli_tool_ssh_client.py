#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

from sshClient import Client
import pkg_checks
import config as config
#from tempest import config
from base import *
import os
import time
#from tempest import test

CONF = config.CONF

class CinderDiagnostics3PARCliSshClientTest(BaseCinderDiagnosticsCliToolTest):
    """
    This testclass is wrriten to test the  SSH client of 3PAR cinder diagnostics CLI tool

    """
    @classmethod
    def setUpClass(cls):
        super(BaseCinderDiagnosticsCliToolTest, cls).setUpClass()

    #@test.attr(type="gate")
    def _test_ssh_connection(self) :
        """ Test SSH Connection to cinder node """
        client = None

        try :
            client = Client(CONF.cinder_hostname, CONF.cinder_ssh_username, CONF.cinder_ssh_password)
            output = client.execute('echo Successful')
            self.assertEqual(output, "Successful\n")

        except Exception as e:
            self.fail("Connection unSuccessful " + e.message)

        finally:
            if client is not None :
                client.disconnect()
    #@test.attr(type="gate")
    def _test_get_file(self) :
        """ Test SSH Connection to cinder node """
        client = None
        temp_file = temp = "report.%.7f.conf" % time.time()

        try :
            client = Client(CONF.cinder_hostname, CONF.cinder_ssh_username, CONF.cinder_ssh_password)
            client.get_file('/etc/cinder/cinder.conf', temp_file)
            self.assertEqual(True,os.path.isfile(temp_file))

        except Exception as e:
            self.fail("Failed to get the file " + e.message)

        finally:
            if client is not None :
                client.disconnect()
            if os.path.isfile(temp_file) is True:
                os.remove(temp_file)
    #@test.attr(type="gate")
    def _test_get_unkown_file(self) :
        """ Test SSH Connection to cinder node """
        client = None
        temp_file = temp = "report.%.7f.conf" % time.time()

        try :
            client = Client(CONF.cinder_hostname, CONF.cinder_ssh_username, CONF.cinder_ssh_password)
            client.get_file('/etc/cinder/cinder_not_present.conf', temp_file)
            self.fail()

        except Exception as e:
            self.assertEqual(False,os.path.isfile(temp_file))

        finally:
            if client is not None :
                client.disconnect()
            if os.path.isfile(temp_file) is True:
                os.remove(temp_file)
    #@test.attr(type="gate")
    def _test_nova_pkg_checks(self) :
        """ Test nova packages """
        try :
            packages = pkg_checks.nova_check(CONF.nova_hostname, CONF.nova_ssh_username, CONF.nova_ssh_password)
            self.assertEqual(2,len(packages))

        except Exception as e:
            self.fail(e.message)

    #@test.attr(type="gate")
    def test_successful_ssh_connection_with_mock(self) :
        """ Test SSH Connection with mock """

        command = 'echo hello'
        response = 'hello'
        self._mock_exec_command({command :response})

        client = None
        try :
            client = Client('127.0.0.1' , 'mock', 'mock')
            output = client.execute(command)
            self.assertEqual(response , output)
        except Exception as e :
            self.fail(e.message)

        finally:
            if client is not None :
                client.disconnect()


    #@test.attr(type="gate")
    def test_failed_ssh_connection_with_mock(self) :
        """ Test SSH Connection with mock """

        command = 'echo hello'
        response = Exception("Connection unSuccessful")
        self._mock_exec_command({command :response})

        client = None
        try :
            client = Client('127.0.0.1' , 'mock', 'mock')
            output = client.execute('echo Successful')
            self.fail("Connection unSuccessful" )
        except Exception as e :
            self.assertEqual("Connection unSuccessful", e.message)

        finally:
            if client is not None :
                client.disconnect()


    #@test.attr(type="gate")
    def test_installed_nova_pkgs(self) :
        """ Test SSH Connection with mock """
        self._mock_exec_command({"dpkg-query -W -f='${Status} ${Version}' sysfsutils" :'install ok installed 2.1.0+repack-3' ,
                                 "dpkg-query -W -f='${Status} ${Version}' sg3-utils" :'install ok installed 2.1.0+repack-3'
                                 })

        responses = pkg_checks.nova_check('127.0.0.1' , 'mock', 'mock')
        for response_item in responses :
            self.assertEqual("pass",response_item.get("installed"))
            self.assertEqual("pass",response_item.get("version"))


    #@test.attr(type="gate")
    def test_uninstalled_nova_pkgs(self) :
        """ Test SSH Connection with mock """
        self._mock_exec_command({"dpkg-query -W -f='${Status} ${Version}' sysfsutils" :'dpkg-query: no packages found matching sysutils' ,
                                 "dpkg-query -W -f='${Status} ${Version}' sg3-utils" :'dpkg-query: no packages found matching sg3-utils'
                                 })
        responses = pkg_checks.nova_check('127.0.0.1' , 'fake', 'fake')
        for response_item in responses :
                 self.assertEqual("fail",response_item.get("installed"))

     #@test.attr(type="gate")
    def test_less_min_version_for_installed_nova_pkg(self) :
        """ Test SSH Connection with mock """

        self._mock_exec_command({"dpkg-query -W -f='${Status} ${Version}' sysfsutils" :'install ok installed 2.0+repack-3' ,
                                 "dpkg-query -W -f='${Status} ${Version}' sg3-utils" :'install ok installed 1.0+repack-3'
                                 })

        responses = pkg_checks.nova_check('127.0.0.1' , 'mock', 'mock')
        for response_item in responses :
                 self.assertEqual("fail",response_item.get("version"))

    #@test.attr(type="gate")
    def test_empty_response_for_installed_nova_pkg(self) :
        """ Test SSH Connection with mock """
        self._mock_exec_command({"dpkg-query -W -f='${Status} ${Version}' sysfsutils" :'' ,
                                 "dpkg-query -W -f='${Status} ${Version}' sg3-utils" :''
                                 })

        responses = pkg_checks.nova_check('127.0.0.1' , 'mock', 'mock')
        for response_item in responses :
                 self.assertEqual("fail",response_item.get("installed"))
                 self.assertEqual(None,response_item.get("version"))



if __name__ == '__main__':
    unittest.main()
