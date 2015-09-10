from __future__ import absolute_import
import argparse
import logging

from . import conf_reader
from cliff.lister import Lister


class CheckArray(Lister):
    """check 3PAR options in the cinder.conf against 3PAR array

    output data:
        Node                node names set by user in cli.conf, names must be
                            unique
                                [NODE-NAME]
        Backend Section     backend section names set by user in cinder.conf,
                            must be unique per node
                                [BACKEND-SECTION-NAME]
        WS API              web service API for array
                                (hp3par_api_url)
        Credentials         username and password for array
                                (hp3par_username, hp3par_password)
        CPG                 CPG to use for volume creation
                                (hp3par_cpg)
        iSCSI IP(s)         array's iSCSI IP addresses to use
                                (hp3par_iscsi_ips)
        Driver Installed    array's volume driver
                                (volume_driver)
    """

    log = logging.getLogger(__name__)

    def get_parser(self, prog_name):
        parser = super(CheckArray, self).get_parser(prog_name)
        parser.formatter_class = argparse.RawTextHelpFormatter
        parser.add_argument('-test',
                            dest='test',
                            action='store_true',
                            help=argparse.SUPPRESS)
        parser.add_argument('-name',
                            nargs='?',
                            default='arrays',
                            help='defaults to checking array configurations')
        return parser

    def take_action(self, parsed_args):
        reader = conf_reader.Reader(parsed_args.test)
        reader.copy_files()
        result = reader.ws_checks(parsed_args.name)
        reader.cleanup()
        if len(result) < 1:
            raise ValueError("%s not found" % parsed_args.name)
        columns = (
            'Node',
            'Backend Section',
            'WS API',
            'Credentials',
            'CPG',
            'iSCSI IP(s)',
            'Driver Installed',
        )

        data = []
        for arr in result:
            data.append((
                arr['node'],
                arr['name'],
                arr['url'],
                arr['credentials'],
                arr['cpg'],
                arr['iscsi'],
                arr['driver'],
            ))
        return (columns, data)
