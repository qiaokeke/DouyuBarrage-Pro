import { Socket } from "socket.io";
import periodlySendMsgTypeDataGetMap from "./msgtype/periodlySendMsgTypeDataGetMap";
import CrawlRecord from "../model/CrawlRecord";
import * as moment from "moment";
import DmCrawler from "./crawler/DmCrawler";
import SingleSendMsgTypesEnum from "./msgtype/singleSendMsgTypes";
import singleSendMsgTypes from "./msgtype/singleSendMsgTypes";

interface RoomUtil {
  roomId: string,
  intervalFlag: any,
  startCrawlTime: string
}

class RoomManager {
  private roomUtilMap: Map<Socket, RoomUtil> = new Map<Socket, RoomUtil>();
  private DATA_SEND_INTERVAL: number = 1000;

  public singleEmitClient = (socket: Socket, msgType: singleSendMsgTypes) => {
    socket.emit(msgType, '');
  }

  public addRoom = async (roomId: string, socket: Socket) => {
    for(const [msgType, dataGetFn] of periodlySendMsgTypeDataGetMap) {
      socket.emit(msgType, await dataGetFn(roomId));
    }

    this.roomUtilMap.set(socket, {
      roomId,
      intervalFlag: 0,
      startCrawlTime: ''
    });

    // emit addRoomSuccess event to client
    this.singleEmitClient(socket, 'add_room_success');

    console.log('add room ' + roomId);
  }

  public removeRoom = (socket: Socket) => {
    const util = this.roomUtilMap.get(socket) as RoomUtil;

    // if started crawling before
    // stop it
    if(util.startCrawlTime !== '') {
      this.stopRoomCrawlProcess(socket);
    }
    this.roomUtilMap.delete(socket);

    console.log('remove room ' + util.roomId);
  }

  public startRoomCrawlProcess = (socket: Socket) => {
    const util = this.roomUtilMap.get(socket) as RoomUtil;
    // periodly send all types of data to new client
    util.intervalFlag = setInterval(async () => {
      for(const [msgType, dataGetFn] of periodlySendMsgTypeDataGetMap) {
        socket.emit(msgType, await dataGetFn(util.roomId));
      }
    }, this.DATA_SEND_INTERVAL);

    DmCrawler.addCrawler(util.roomId);
    util.startCrawlTime = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');

    // emit startCrawlSuccess event to client
    this.singleEmitClient(socket, 'start_crawl_success');

    console.log(`add room ${util.roomId} crawl process`);
  }

  public stopRoomCrawlProcess = async (socket: Socket) => {
    const util = this.roomUtilMap.get(socket) as RoomUtil;    

    clearInterval(util.intervalFlag);
    DmCrawler.removeCrawler(util.roomId);
    await CrawlRecord.upsert({
      start_time: util.startCrawlTime,
      stop_time: moment(Date.now()).format('YYYY-MM-DD HH:mm:ss'),
      room_id: util.roomId,
      dm_num: Math.ceil(Math.random() * 2000)
    });
    util.startCrawlTime = '';

    this.singleEmitClient(socket, 'stop_crawl_success');

    console.log(`stop room ${util.roomId} crawl process`);
  }

  public getCrawlStartTimeByRoomId = (roomId: string) => {
    for(const [socket, util] of this.roomUtilMap) {
      if(roomId === util.roomId) {
        return util.startCrawlTime;
      }
    }
    return '';
  }

  // stop all crawl process
  // write all crawl record to db
  public forceStopAll = async () => {
    for(const [socket, util] of this.roomUtilMap) {
      if(util.startCrawlTime !== '') {
        await this.stopRoomCrawlProcess(socket);
      }

      this.singleEmitClient(socket, 'stop_crawl_success');
    }
  }
}

export default new RoomManager();