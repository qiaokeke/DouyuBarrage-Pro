type singleSendMsgTypes =
  | 'add_room'
  | 'start_crawl'
  | 'stop_crawl'
  | 'add_keyword'
  | 'delete_keyword'
  | 'request_send_dm'
  | 'stop_send_dm'
  | 'add_highlight_record';

export default singleSendMsgTypes;
