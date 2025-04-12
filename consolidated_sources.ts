// Consolidated sources from: C:\Users\devvi\OneDrive\Desktop\opt\ascend-group\true-ecommerce-etl-kafka
// Consolidation timestamp: 2025-04-11 12:58:19
// Tool Name: repo-inspector
// Command Executed: consolidate-sources
// Output File: C:\Users\devvi\OneDrive\Desktop\opt\personal-projects\repository-inspector\consolidated_sources.ts
// Root Directory: C:\Users\devvi\OneDrive\Desktop\opt\ascend-group\true-ecommerce-etl-kafka
// Include Extensions: .env, .js, .json, .ts
// Exclude Patterns: .git, .json, build, coverage, dist, node_modules, package-lock.json

// jest.config.js

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: ["**/tests/**/*.ts", "**/?(*.)+(spec|test).ts"],
    transform: {
      "^.+\\.(ts|tsx)$": "ts-jest",
    },
  };
  
  
  // src/base.route.ts
  
  // src/routes/base.router.ts
  
  import { Router } from 'express';
  import telnetRoute from './shared-modules/telnet/routes/telnet.route';
  import kafkaRoute from './kafka/routes/kafka.route';
  
  const baseRouter = Router();
  
  baseRouter.get('/', (req, res) => res.status(200).send('OK'));
  baseRouter.use('/telnet', telnetRoute);
  baseRouter.use('/kafka', kafkaRoute);
  
  export default baseRouter;
  
  
  // src/external-apis/etl-client/helpers/datetime.helper.ts
  
  export function formatDateNow() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milisec = String(now.getMilliseconds());
      return `${year}/${month}/${day}/${hours}:${minutes}:${seconds}:${milisec}`;
  }
  
  // src/external-apis/etl-client/interfaces/etl-client.interface.ts
  
  export interface StartWorkflowBody {
    workflowName: string;
    taskQueue: string;
    input?: any;
  }
  
  
  // src/external-apis/etl-client/services/etl-client.ts
  
  import { StartWorkflowBody } from "../interfaces/etl-client.interface";
  import { HttpClientBase } from "../../../shared/services/http-client-base";
  import { AxiosRequestHeaders } from "axios";
  import { formatDateNow } from "../helpers/datetime.helper";
  
  export default class EtlClient extends HttpClientBase {
    constructor() {
      super(process.env.ETL_CLIENT_URL!);
    }
  
    async startWorkflow(startWorkflowBody: StartWorkflowBody, headers?: Record<string, string>): Promise<any> {
      try {
        const response = await this.post("/start", startWorkflowBody, {
          headers
        });
        return response.data;
      } catch (error: any) {
        throw error;
      }
  
    getMoiCreateProductBody(messageValues: any[]) {
      const workflowName = 'moiWorkflow';
      const formattedDateNow = formatDateNow();
      return {
        workflowName: workflowName,
        workflowId: `${workflowName}-${formattedDateNow}`,
        taskQueue: "pim-moi-task-queue",
        input: messageValues,
      };
    }
  
    getMcsCreateProductBody(messageValues: any[]) {
      const workflowName = 'mcsWorkflow';
      const formattedDateNow = formatDateNow();
      return {
        workflowName: workflowName,
        workflowId: `${workflowName}-${formattedDateNow}`,
        taskQueue: "pim-mcs-task-queue",
        input: messageValues,
      };
    }
  
    getPpmCreateProductBody(messageValues: any[]) {
      const workflowName = 'ppmWorkflow';
      const formattedDateNow = formatDateNow();
      return {
        workflowName: workflowName,
        workflowId: `${workflowName}-${formattedDateNow}`,
        taskQueue: "pim-ppm-task-queue",
        input: messageValues,
      };
    }
  
  
  // src/external-apis/etl-client/tests/etl-client.spec.ts
  
  import EtlClient from "../services/etl-client";
  import { HttpClientBase } from "../../../shared/services/http-client-base";
  import { mcsContentBundleInput, mcsContentWithPp, mcsCouponLifeStyleInput, mcsInsuranceWithPp, mcsPackageMultipleBenefits } from "../../../kafka/mocks/mcs.mock";
  import { moiProductInput } from "../../../kafka/mocks/moi.mock";
  
  jest.mock("../../../shared/services/http-client-base");
  
  const mockedHttpClientBase = HttpClientBase as jest.MockedClass<
    typeof HttpClientBase
  >;
  
  describe("EtlClient", () => {
    let etlClient: EtlClient;
    let mockPost: jest.Mock;
    let headers: Record<string, string>;
  
    beforeEach(() => {
      jest.clearAllMocks();
  
      mockedHttpClientBase.prototype.post = jest.fn();
      mockPost = mockedHttpClientBase.prototype.post as jest.Mock;
  
      jest.spyOn(console, "log").mockImplementation(() => { });
      jest.spyOn(console, "error").mockImplementation(() => { });
  
      etlClient = new EtlClient();
      headers = {};
    });
  
    afterEach(() => {
      jest.restoreAllMocks();
    });
  
    test("getMoiCreateProductBody returns correctly formatted body", () => {
      const products = [moiProductInput];
      const body = etlClient.getMoiCreateProductBody(products);
  
      expect(body.workflowName).toEqual("moiWorkflow");
      expect(body.taskQueue).toEqual("pim-moi-task-queue");
      expect(body.input).toEqual(products);
      expect(body).toHaveProperty('workflowId');
    });
  
    test("getMcsCreateProductBody returns correctly formatted body", () => {
      const products = [
        mcsContentBundleInput,
        mcsCouponLifeStyleInput,
        mcsInsuranceWithPp,
        mcsContentWithPp,
        mcsPackageMultipleBenefits,
      ];
      const body = etlClient.getMcsCreateProductBody(products);
  
      expect(body.workflowName).toEqual("mcsWorkflow");
      expect(body.taskQueue).toEqual("pim-mcs-task-queue");
      expect(body.input).toEqual(products);
      expect(body).toHaveProperty('workflowId'); // Check only for the property's existence
    });
  
    test("startWorkflow posts the correct body and handles the response", async () => {
      const products = [moiProductInput];
      const requestBody = etlClient.getMoiCreateProductBody(products);
      const mockResponse = { status: 200, data: "Workflow success" };
      mockPost.mockResolvedValue(mockResponse);
  
      const response = await etlClient.startWorkflow(requestBody, headers);
  
      expect(mockPost).toHaveBeenCalledWith("/start", requestBody, { headers });
      expect(response).toBe("Workflow success");
    });
  
    test("startWorkflow handles errors correctly", async () => {
      const products = [moiProductInput];
      const requestBody = etlClient.getMoiCreateProductBody(products);
      const errorMessage = "Failed to start workflow";
      mockPost.mockRejectedValue(new Error(errorMessage));
  
      await expect(etlClient.startWorkflow(requestBody, headers)).rejects.toThrow(
        errorMessage
      );
  
      expect(mockPost).toHaveBeenCalledWith("/start", requestBody, { headers });
    });
  
  
  // src/index.ts
  
  import dotenv from "dotenv";
  dotenv.config();
  
  import express from "express";
  import baseRouter from "./base.route";
  import notFoundRoute from "./not-found.route";
  import { moiConsumerAdapter } from "./kafka/services/kafka-moi-consumer";
  import { mcsConsumerAdapter } from "./kafka/services/kafka-mcs-consumer";
  import { ppmConsumerAdapter } from "./kafka/services/kafka-ppm-consumer";
  import { errorHandler } from "./shared/middlewares/error-handler.middleware";
  import { AppLogger } from "./shared-modules/logger/app-logger";
  
  const app = express();
  const port = process.env.APP_PORT || 3000;
  
  // Disable the X-Powered-By header
  app.disable("x-powered-by")
  
  const logger = new AppLogger()
  
  app.use(express.json());
  app.use('/etl-kafka', baseRouter);
  app.use(notFoundRoute);
  app.use(errorHandler);
  
  process.on("uncaughtException", (error) => {
    console.error("Unhandled Exception:", error);
    logger.error('Unhandled Exception:', { error })
    process.exit(1);
  });
  
  process.on("unhandledRejection", (reason: string, error: Promise<any>) => {
    console.error("Unhandled Rejection:", error);
    logger.error('Unhandled Rejection:', { reason, error })
    process.exit(1);
  });
  
  app.listen(port, async () => {
    logger.info(`App listening on port ${port}`);
  
    await initializeKafkaConsumers();
  });
  
  async function initializeKafkaConsumers() {
    const consumers = [moiConsumerAdapter, mcsConsumerAdapter, ppmConsumerAdapter];
    for (const consumer of consumers) {
      try {
        await consumer.connectAndSubscribe();
        console.log(`${consumer.constructor.name} connected and subscribed successfully.`)
      } catch (error: any) {
        console.error(`${consumer.constructor.name} failed to initialize.`, error.message)
      }
  
  async function closeKafkaConsumers() {
    const consumers = [moiConsumerAdapter, mcsConsumerAdapter, ppmConsumerAdapter];
    for (const consumer of consumers) {
      try {
        await consumer.disconnect();
        console.log(`${consumer.constructor.name} disconnected successfully.`);
      } catch (error: any) {
        console.error(`${consumer.constructor.name} failed to disconnect.`, { message: error.message });
      }
  
  // src/interface/logger.ts
  
  export interface Logger {
      txid?: string
      start_date?: string
      channel?: string
      product?: string
      request: object|Array<any>|string|undefined
      response: object
      result_code: string
      result_desc?: string
      result_indicator: string
      "@suffix"?: string
      "@team"?: string
      campaign_code?: string
      campaign_name?: string
      certificate_id?: string
      certificate_type?: string
      customer_extra_info?: string
      customer_name?: string
      customer_priceplan?: string
      customer_subtype?: string
      customer_type?: string
      dealer_code?: string
      elapsed_time?: string
      employee_id?: string
      end_date?: string
      endpoint?: string
      extra_info?: string
      header?: string
      info?: string
      kb_url?: string
      level?: string
      log_cat?: string
      msg?: string
      msisdn?: string
      product_info?: string
      project_name?: string
      ref_id?: string
      remark?: string
      requestor?: string
      search_key?: string
      service_type?: string
      sms_to_customer?: string
      stack_trace?: string
      stepname?: string
      step_request?: string
      step_response?: string
      step_txid?: string
      sub_channel?: string
      system?: string
      time?: string
      transaction_data?: string
      transaction_extra_info?: string
    }
    
  
  // src/kafka/constants/kafka.constant.ts
  
  export enum KAFKA_MESSAGE_STATUSES {
      PENDING = 'pending',
      SENT = 'sent',
  } 
  
  // src/kafka/helpers/kafka-configurations.helper.ts
  
  import { dynamoClient } from "../../shared-modules/dynamo/dynamo-client";
  import { InternalServiceConfig, ServiceConfig } from "../../types";
  
  export class KafkaConfigurations {
    protected isEnable = true;
    protected batchSize = 25;
    protected messageValueSize = 10;
    protected interBatchDelay = 1000;
    protected maxAttempts = 5; // Maximum number of retry attempts
    protected baseDelay = 1000; // Base delay in milliseconds
    protected expFactor = 3; // Factor by which the delay will increase
  
    protected async loadConfigurations(
      skey: keyof InternalServiceConfig
    ): Promise<void> {
      const [service] =
        await dynamoClient.queryETLKafkaConfigurations<ServiceConfig>(
          process.env.KAFKA_CONFIG_TABLE || "DYNAMODB_TABLE_NAME",
          process.env.KAFKA_CONFIG_SERVICE || "etl_kafka_configurations"
        );
  
      if (!service?.configs) return;
  
      const {
        batchSize,
        messageValueSize,
        interBatchDelay,
        maxAttempts,
        baseDelay,
        expFactor,
        internalConfigs,
      } = service.configs;
  
      // Get internal config for the specific service key, or an empty object if none exists.
      const internal = internalConfigs?.[skey] || {};
  
      // Update properties: prefer internal config if provided, else use global config, otherwise keep the class default.
      this.isEnable = internal.isEnable ?? this.isEnable;
      this.batchSize = internal.batchSize ?? batchSize ?? this.batchSize;
      this.messageValueSize =
        internal.messageValueSize ?? messageValueSize ?? this.messageValueSize;
      this.interBatchDelay =
        internal.interBatchDelay ?? interBatchDelay ?? this.interBatchDelay;
      this.maxAttempts = internal.maxAttempts ?? maxAttempts ?? this.maxAttempts;
      this.baseDelay = internal.baseDelay ?? baseDelay ?? this.baseDelay;
      this.expFactor = internal.expFactor ?? expFactor ?? this.expFactor;
  
      console.log(`[${skey}] this.isEnable: `, this.isEnable);
      console.log(`[${skey}] this.batchSize: `, this.batchSize);
      console.log(`[${skey}] this.messageValueSize: `, this.messageValueSize);
      console.log(`[${skey}] this.interBatchDelay: `, this.interBatchDelay);
      console.log(`[${skey}] this.maxAttempts: `, this.maxAttempts);
      console.log(`[${skey}] this.baseDelay: `, this.baseDelay);
      console.log(`[${skey}] this.expFactor: `, this.expFactor);
    }
  
  
  // src/kafka/helpers/kafka-consumer.helper.ts
  
  import { KafkaMessage, IHeaders } from "kafkajs";
  import { KAFKA_MESSAGE_STATUSES } from "../constants/kafka.constant";
  
  export function formatMessage(
    groupId: string,
    topic: string,
    partition: number,
    message: KafkaMessage
  ): any {
    const { key, value, headers, offset, timestamp } = message;
  
    const decodedKey = key ? key.toString() : null;
    const decodedValue = value ? value.toString() : '';
  
    let parsedValue;
    try {
      parsedValue = JSON.parse(decodedValue);
    } catch (error) {
      console.error("Failed to parse message value:", error);
      parsedValue = {};
    }
  
    let parsedHeaders: IHeaders = {};
    if (headers) {
      parsedHeaders = Object.entries(headers).reduce((acc: IHeaders, [headerKey, headerValue]) => {
        if (headerValue) {
          acc[headerKey] = headerValue.toString('utf8');
        }
        return acc;
      }, {});
    }
  
    const receivedTimestamp = new Date().getTime();
    const producedAt = new Date(receivedTimestamp).toISOString();
    const receivedAt = new Date(receivedTimestamp).toISOString();
  
    return {
      message_id: `${groupId}-${topic}-${partition}-${offset}-${receivedTimestamp}`,
      groupId,
      topic,
      partition,
      offset,
      message_key: decodedKey,
      message_value: parsedValue,
      headers: parsedHeaders,
      status: KAFKA_MESSAGE_STATUSES.PENDING,
      timestamp,
      producedAt, // Original Kafka-produced timestamp
      receivedAt,
    };
  }
  
  
  // src/kafka/mocks/kafka.mock.ts
  
  // src/kafka/tests/mocks/kafka.mocks.ts
  
  import { KafkaMessage } from 'kafkajs';
  import { moiProductInput } from './moi.mock';
  
  export const testGroupId = 'testGroup';
  export const testTopic = 'testTopic';
  export const testPartition = 0;
  
  export const baseMessage: KafkaMessage = {
      key: Buffer.from('key123'),
      value: Buffer.from(JSON.stringify(moiProductInput)),
      headers: {
          header1: Buffer.from('headerValue'),
      },
      offset: '100',
      timestamp: '1622547600000',
      attributes: 0
  };
  
  export const corruptMessage: KafkaMessage = {
      ...baseMessage,
      value: Buffer.from('not a valid JSON')
  };
  
  export const messageWithNulls: KafkaMessage = {
      ...baseMessage,
      key: null,
      value: null
  };
  
  
  // src/kafka/mocks/mcs.mock.ts
  
  export const mcsContentBundleInput = {
    package_id: "TID0241",
    action: "N",
    package: {
      package_name: "iQIYI VIP (Standard) AutoRenew",
      package_type: "recurring",
      soc_type: "OCR",
      offer_charge_pre: "",
      offer_charge_pos: "TOPABS73",
      campaign_code: "TID",
      campaign_name: "Content Campaign",
      start_date: "2023-02-11 00:00:00",
      expire_date: "2099-02-26 00:00:00",
      period_day: "30",
      period_unit: "day",
      duration: "12",
      package_partner_code: "IQIYI_SOFT_BUNDLE_2023",
      partner_name: "TRUEID",
      "package_content_type ": "CONTENT",
      package_sub_content_type: "IQIYI",
    },
  };
  
  export const mcsCouponLifeStyleInput = {
    package_id: "LIF0046",
    action: "N",
    package: {
      package_name: "Lifestyle Topping Package",
      package_type: "recurring",
      soc_type: "OCR",
      offer_charge_pre: "",
      offer_charge_pos: "TOPABS67",
      campaign_code: "LIF",
      campaign_name: "Life Style campaign",
      start_date: "2023-02-11 00:00:00",
      expire_date: "2099-02-26 00:00:00",
      period_day: "30",
      period_unit: "day",
      duration: "12",
      package_partner_code: "QUOTA_MCDONALD",
      partner_name: "TRUEYOU",
      "package_content_type ": "LIFESTYLE",
      package_sub_content_type: "MCDONALDS",
    },
  };
  
  export const mcsInsuranceWithPp = {
    package_id: "FWD0111",
    action: "N",
    package: {
      "pack-age_name": "PA 100,000+stack up (cover 36 months) 5G SUPER Sport",
      package_type: "recurring",
      offer_charge_pos: "FWDAAS47",
      campaign_code: "FWD",
      campaign_name: "FWD Insurance",
      start_date: "2024-01-12 00:00:00 ",
      expire_date: "2026-12-31 00:00:00 ",
      period_day: "30",
      period_unit: "day",
      duration: "12",
      package_partner_code: "TPOSPAST001",
      partner_name: "FWD",
      allow_priceplan: ["MSMRDP82", "MSMRDP83"],
      "package_content_type ": "FWD",
      "package_sub_content_type ": "FWD",
    },
  };
  
  export const mcsContentWithPp = {
    package_id: "TID0384",
    action: "N",
    package: {
      package_name: "True Vision Now GO Asian 12 months",
      package_type: "recurring",
      campaign_code: "TID",
      campaign_name: "Content Campaign",
      start_date: "2024-01-12 00:00:00 ",
      expire_date: "2026-12-31 00:00:00 ",
      period_day: "30",
      period_unit: "day",
      duration: "12",
      package_partner_code: "TMH_VAS_TVSNOWGOASIAN",
      partner_name: "TRUEID",
      allow_priceplan: ["MSMRDP93", "MSMRDP94", "MSMRDP95"],
      "package_content_type ": "CONTENT",
      package_sub_content_type: "TVS",
    },
  };
  
  export const mcsPackageMultipleBenefits = {
    package_id: "NEC0019",
    action: "N",
    package: {
      package_name: "Net10GB+IQIYI WETV 30Days AutoRenew",
      package_type: "2",
      soc_type: "OCR",
      offer_charge_pre: "",
      offer_charge_pos: "DTD30A70",
      campaign_code: "C0009",
      campaign_name: "TrueID Premium League Program",
      start_date: "2023-02-21T00:00:00",
      expire_date: "2025-01-31T00:00:00",
      period_day: "30",
      period_unit: "day",
      duration: "12",
      package_partner_code: "",
      partner_name: "",
      package_content_type: "COMBO",
      package_sub_content_type: "COMBO",
      allow_priceplan: "",
      combo_package_info: [
        {
          package_partner_code: "IQIYI_SOFT_BUNDLE_2023",
          partner_name: "TRUEIDV3",
          package_content_type: "CONTENT",
          package_sub_content_type: "IQIYI",
        },
        {
          package_partner_code: "WETV_BUNDLE_SMALL",
          partner_name: "TRUEIDV3",
          package_content_type: "CONTENT",
          package_sub_content_type: "WETV",
        },
      ],
    },
  };
  
  
  // src/kafka/mocks/moi.mock.ts
  
  export const moiProductInput = {
    SOC_CD: "23681529",
    SOC_NAME: "MSMRCP10",
    ACTION_SOC: "E",
    SOC_INFO: {
      SOC_DESCRIPTION: "5G Together Device 1199_Voice 250min_Net Unltd",
      STRUCTURE_LEVEL: "C",
      SERVICE_LEVEL: "C",
      PRODUCT_TYPE: "RR",
      SOC_TYPE: "P",
      OVERRIDE_RC_FLAG: "N",
      TR_PRODUCT_SUB_TYPE: "R",
      COST_INFO: [
        {
          COST: "CCBS",
          TYPE: "RC",
          PRICE: "1199",
        },
      ],
      TR_CONTRACT_IND: "",
      TR_CONTRACT_TYPE: "",
      TR_CONTRACT_TERM: "0",
      TR_OFFER_EXCL_GRP_NAME: "",
      SALE_EFFECTIVEDATE_CCBS: "2023-01-13 00:00:000",
      SALE_EXPIREDATE_CCBS: "2023-08-31 00:00:000",
      CUSTOMER_TYPE_INFO: ["I", "B", "C"],
      TR_DURATION_MONTH: "6",
      NEXT_PP_INFO: {
        NEXT_PP_FLAG: "Y",
        DETAIL: [
          {
            PP: "EBFOAP22",
            PP_DESC: "Biz&Ent 599_Onnet12PM-6PM,V350,UNLTD4GB,WiFi_Next1",
            RC: "599",
            OC: "0",
            DURATION_MONTH: "12",
          },
          {
            PP: "EBFOAP23",
            PP_DESC: "Biz&Ent 599_Onnet12PM-6PM,V350,UNLTD2GB,WiFi_Next2",
            RC: "599",
            OC: "0",
            DURATION_MONTH: "0",
          },
        ],
      },
    ALLOWANCE_INFO: {
      FF_NUMBER: "0",
      CUG: "N",
      VOICE: {
        QUOTA: "250",
        VOICE_GROUP: "ALLNET",
        VOICE_INFO: [
          {
            EVENT_TYPE: "FIX,OF,ON",
            QUOTA: "250",
            QUOTA_UNIT: "Minutes",
          },
        ],
      },
      WIFI: {
        UNLIMIT: "Y",
      },
      DATA: {
        FOUR_G_NOLIMIT: "N",
        DATA_INFO: [
          {
            SUB_TYPE: "Internet Vol",
            DATA_GROUP: "FIX SPEED",
            QUOTA: "0",
            QUOTA_UNIT: "",
            FUP_SPEED: "",
            FUP_SPEED_UNIT: "",
            MAX_SPEED: "1024",
            MAX_SPEED_UNIT: "Mbps",
            FUP_SPEED_CONFIG: "",
            FUP_SPEED_CONFIG_UNIT: "",
            CUSTOMER_TYPE_INFO: ["I", "B", "C"],
          },
        ],
      },
    RATE_INFO: {
      VOICE: {
        BUFFET_FLAG: "N",
        BUFFET_TYPE: "ON",
        MESSAGE:
          "โทรช่วงเที่ยงคืน ถึง หกโมงเย็น<br/>&nbsp;&nbsp;&nbsp;-&nbsp;โทรในเครือข่าย  60 นาทีแรก ฟรี<br/>&nbsp;&nbsp;&nbsp;-&nbsp;โทรในเครือข่าย ตั้งแต่นาทีที่ 60 นาทีละ  1.25 บาท<br/>โทรช่วงหกโมงเย็น ถึง เที่ยงคืน<br/>&nbsp;&nbsp;&nbsp;-&nbsp;โทรในเครือข่าย นาทีละ  1.25 บาท<br/>โทรช่วงเวลาปกติ<br/>&nbsp;&nbsp;&nbsp;-&nbsp;โทรนอกเครือข่าย นาทีละ  1.25 บาท",
        VOICE_INFO: [
          {
            EVENT_TYPE: "FIX",
            BUFFET_FLAG: "N",
            VOICE_GROUP: "OFFNET",
            PERIOD: "STD0_Normal",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
            ],
          },
          {
            EVENT_TYPE: "OF",
            BUFFET_FLAG: "N",
            VOICE_GROUP: "OFFNET",
            PERIOD: "STD0_Normal",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
            ],
          },
          {
            EVENT_TYPE: "ON",
            BUFFET_FLAG: "N",
            VOICE_GROUP: "ONNET",
            PERIOD: "STDO_00:00-18:00",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "18:00:00",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "60",
                PRICE: "0",
              },
              {
                START_SCALE: "60",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
            ],
          },
          {
            EVENT_TYPE: "ON",
            BUFFET_FLAG: "N",
            VOICE_GROUP: "ONNET",
            PERIOD: "STDO_18:00-24:00",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "18:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
            ],
          },
        ],
      },
      SMS: {
        MESSAGE: "ส่งข้อความครั้งละ 1.25 บาท",
        SMS_INFO: [
          {
            EVENT_TYPE: "OF",
            PERIOD: "STD0_Normal",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "5",
              },
            ],
          },
          {
            EVENT_TYPE: "ON",
            PERIOD: "STD0_Normal",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "1.25",
              },
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "5",
              },
            ],
          },
        ],
      },
      MMS: {
        MESSAGE: "ส่งข้อความรูปภาพครั้งละ 5 บาท",
        MMS_INFO: [
          {
            EVENT_TYPE: "OF,ON",
            PERIOD: "STD0_Normal",
            DATE: "0,1,2,3,4,5,6",
            START_TIME: "00:00:00",
            END_TIME: "23:59:59",
            SCALE_INFO: [
              {
                START_SCALE: "0",
                END_SCALE: "9999",
                PRICE: "5",
              },
            ],
          },
        ],
      },
  };
  
  // src/kafka/routes/kafka.route.ts
  
  // src/routes/kafka.route.ts
  
  import { NextFunction, Request, Response, Router } from "express";
  import { kafkaBaseClient } from "../services/kafka-client-base";
  import { kafkaMonitoringService } from "../services/kafka-monitoring.service";
  import { ppmConsumerAdapter } from "../services/kafka-ppm-consumer";
  import { KafkaProducerClient } from "../services/kafka-client-producer";
  import { moiConsumerAdapter } from "../services/kafka-moi-consumer";
  import { mcsConsumerAdapter } from "../services/kafka-mcs-consumer";
  import { KafkaClientTest } from "../services/kafka-client-test";
  import { apiKeyValidator } from "../../shared/middlewares/api-key.middleware";
  import { dynamoClient } from "../../shared-modules/dynamo/dynamo-client";
  
  const router = Router();
  
  router.get('/count-consumed-messages', apiKeyValidator, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await dynamoClient.countAllItems(process.env.KAFKA_MESSAGES_TABLE!);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  });
  router.get('/get-consumed-messages', apiKeyValidator, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extracting parameters from the query
      const { groupId, topic, messageValueExists, headersExist } = req.query;
  
      // Parsing 'limit' with a default value
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  
      // Converting string query parameters to boolean
      const messageExistsFilter = messageValueExists === 'true';
      const headersExistFilter = headersExist === 'true';
  
      // Passing the parameters to the scanAllItems function
      const messages = await dynamoClient.scanAllItems(
        process.env.KAFKA_MESSAGES_TABLE!,
        limit,
        groupId as string | undefined,
        topic as string | undefined,
        messageExistsFilter,
        headersExistFilter
      );
  
      // Sending the result as JSON
      res.status(200).json(messages);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Route to delete all consumed messages from DynamoDB
  router.delete('/clear-consumed-messages', apiKeyValidator, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dynamoClient.deleteAllItems(process.env.KAFKA_MESSAGES_TABLE!, "message_id");
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  });
  
  router.post('/test-kafka-connection', async (req: Request, res: Response, next: NextFunction) => {
    let kafkaClientTest;
    try {
      const { consumers, ...kafkaConfig } = req.body;
  
      if (!kafkaConfig || !consumers || !Array.isArray(consumers)) {
        throw new Error('Invalid request parameters');
      }
  
      kafkaClientTest = KafkaClientTest.getInstance(kafkaConfig);
  
      const results = [];
  
      for (const consumerInfo of consumers) {
        const { groupId, topics } = consumerInfo;
  
        if (!groupId || !topics || !Array.isArray(topics)) {
          throw new Error('Invalid groupId or topics configuration');
        }
  
        const consumer = kafkaClientTest.kafka.consumer({ groupId });
        await consumer.connect();
  
        for (const topic of topics) {
          await consumer.subscribe({ topic, fromBeginning: true });
        }
  
        const messages: any[] = [];
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            if (message.value) {
              messages.push({
                groupId,
                topic,
                partition,
                message: message.value.toString()
              });
  
              await consumer.disconnect();
              return;
            }
          },
        });
  
        results.push({ groupId, topics, messages });
      }
  
      const logs = kafkaClientTest.fetchLogs();
      kafkaClientTest.clearLogs();
  
      return res.status(200).json({
        message: "Kafka connection and message consumption test successful.",
        results,
        logs
      });
    } catch (error: any) {
      const logs = kafkaClientTest ? kafkaClientTest.fetchLogs() : [];
      kafkaClientTest?.clearLogs();
  
      return res.status(500).json({
        message: "An unexpected error occurred. Please contact our support team, and we'll get this sorted for you as soon as possible!",
        error: error.message,
        logs
      });
    }
  });
  
  router.post('/consumers/reconnect', apiKeyValidator, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await moiConsumerAdapter.reconnect();
      await mcsConsumerAdapter.reconnect();
      await ppmConsumerAdapter.reconnect();
      return res.status(200).send("Consumers reconnected successfully.");
    } catch (error: any) {
      next(error);
    }
  });
  
  router.get(
    "/send-messages",
    apiKeyValidator,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const kafkaProducer = KafkaProducerClient.getInstance(kafkaBaseClient.kafka);
        await kafkaProducer.sendMessages();
        return res.send("Test messages sent to Kafka successfully.");
      } catch (error) {
        next(error);
      }
  );
  
  router.get(
    "/check-consumers-health",
    apiKeyValidator,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const moiConsumerAdapterHealth = await moiConsumerAdapter.checkConsumerHealth();
        const mcsConsumerAdapterHealth = await mcsConsumerAdapter.checkConsumerHealth();
        const ppmConsumerAdapterHealth = await ppmConsumerAdapter.checkConsumerHealth();
  
        return res.send([moiConsumerAdapterHealth, mcsConsumerAdapterHealth, ppmConsumerAdapterHealth]);
      } catch (error) {
        return next(error);
      }
  );
  
  router.post(
    "/check-consumers-offsets",
    apiKeyValidator,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { groupId, topics } = req.body;
  
        const consumerOffsets = await kafkaMonitoringService.getConsumerOffsets(
          groupId,
          topics
        );
  
        return res.send(consumerOffsets);
      } catch (error) {
        return next(error);
      }
  );
  
  export default router;
  
  
  // src/kafka/services/kafka-client-base.ts
  
  // src/adapters/kafka-client-base.ts
  
  import { Kafka, KafkaConfig, Admin, logLevel } from "kafkajs";
  import fs from "fs";
  import { APP_ENVS } from "../../shared/constants/app-envs";
  import { AppLogger } from "../../shared-modules/logger/app-logger";
  
  class KafkaClientBase {
    private static instance: KafkaClientBase;
    private appEnv: string;
    kafka: Kafka;
    admin: Admin;
  
    constructor() {
      this.appEnv = process.env.APP_ENV!;
      const kafkaConfig = this.getKafkaConfig();
      this.kafka = new Kafka(kafkaConfig);
      this.admin = this.kafka.admin();
    }
  
    public static getInstance(): KafkaClientBase {
      if (!KafkaClientBase.instance) {
        KafkaClientBase.instance = new KafkaClientBase();
      }
      return KafkaClientBase.instance;
    }
  
    private getKafkaConfig(): KafkaConfig {
      const kafkaConfig: KafkaConfig = {
        clientId: process.env.KAFKA_CLIENT_ID || "default-client-id",
        brokers: process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"],
        retry: {
          initialRetryTime: 1000,
          retries: 5
        },
      };
  
      console.log("KafkaClientBase config: ", JSON.stringify(kafkaConfig));
  
      return kafkaConfig;
    }
  
    // private getKafkaConfig(): KafkaConfig {
    //   const kafkaConfig: KafkaConfig = {
    //     clientId: "kut-app-ecp",
    //     brokers: ['111.84.55.149:8080'],
    //     retry: {
    //       initialRetryTime: 1000,
    //       retries: 3,
    //     },
    //     ssl: {
    //       rejectUnauthorized: false,
    //       passphrase: '32QgvTQ0YhEYYGoH',
    //       ca: [fs.readFileSync('./storage/private/configs/ca.pem', "utf-8")],
    //       key: fs.readFileSync('./storage/private/configs/keystore.key', "utf-8"),
    //       cert: fs.readFileSync('./storage/private/configs/keystore.crt', "utf-8"),
    //     }
    //   };
  
    //   console.log("KafkaClientBase config: ", JSON.stringify(kafkaConfig));
  
    //   return kafkaConfig;
    // }
  }
  
  export const kafkaBaseClient = KafkaClientBase.getInstance();
  
  
  // src/kafka/services/kafka-client-producer.ts
  
  // src/adapters/kafka-producer-client.ts
  
  import { Kafka, Producer, Message, Partitioners } from "kafkajs";
  import { moiProductInput } from "../mocks/moi.mock";
  import {
    mcsContentBundleInput,
    mcsContentWithPp,
    mcsCouponLifeStyleInput,
    mcsInsuranceWithPp,
    mcsPackageMultipleBenefits,
  } from "../mocks/mcs.mock";
  
  export class KafkaProducerClient {
    private static instance: KafkaProducerClient;
    private producer: Producer;
  
    private constructor(kafka: Kafka) {
      this.producer = kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
      });
    }
  
    public static getInstance(kafka: Kafka): KafkaProducerClient {
      if (!KafkaProducerClient.instance) {
        KafkaProducerClient.instance = new KafkaProducerClient(kafka);
      }
      return KafkaProducerClient.instance;
    }
  
    public async connect(): Promise<void> {
      await this.producer.connect();
    }
  
    public async disconnect(): Promise<void> {
      await this.producer.disconnect();
    }
  
    public async sendMessages(): Promise<void> {
      try {
        await this.producer.connect();
        await this.sendMoiMessages();
        await this.sendMcsMessages();
        await this.sendPpmMessages();
      } catch (error: any) {
        console.error("Failed to send test messages:", error.message);
  
        throw error;
      } finally {
        await this.producer.disconnect();
      }
  
    private async sendMoiMessages() {
      const numberOfMessages = 50;
      // const moiProducts = [moiProductInput, moiProductInput];
      const moiProducts = moiProductInput;
      const moiMessages: any[] = Array.from(
        { length: numberOfMessages },
        (_, index) => ({
          key: `key-${index + 1}`,
          value: JSON.stringify(moiProducts),
          headers: {
            ContentType: Buffer.from('application/json'),
            Version: Buffer.from('1.0'),
            Timestamp: Buffer.from(Date.now().toString()),
            test_custom_header: Buffer.from('none')
          }
        })
      );
  
      await this.producer.send({
        topic: process.env.KAFKA_MOI_TOPIC!,
        messages: moiMessages,
      });
      console.log(
        `MOI Messages sent successfully to ${process.env.KAFKA_MOI_TOPIC}, number of messages: ${moiMessages.length}`
      );
    }
  
    private async sendMcsMessages() {
      const numberOfMessages = 50;
      const mcsProducts = [
        mcsContentBundleInput,
        mcsCouponLifeStyleInput,
        mcsInsuranceWithPp,
        mcsContentWithPp,
        mcsPackageMultipleBenefits,
      ];
      const mcsMessages: Message[] = Array.from(
        { length: numberOfMessages },
        (_, index) => ({
          key: `key-${index + 1}`,
          value: JSON.stringify(mcsProducts),
          headers: {
            ContentType: Buffer.from('application/json'),
            Version: Buffer.from('1.0'),
            Timestamp: Buffer.from(Date.now().toString()),
            test_custom_header: Buffer.from('none')
          }
        })
      );
  
      await this.producer.send({
        topic: process.env.KAFKA_MCS_TOPIC!,
        messages: mcsMessages,
      });
      console.log(
        `MCS Messages sent successfully to ${process.env.KAFKA_MCS_TOPIC}, number of messages: ${mcsMessages.length}`
      );
    }
  
    private async sendPpmMessages(): Promise<void> {
      const numberOfMessages = 50;
      const ppmProducts = [
        mcsContentBundleInput,
        mcsCouponLifeStyleInput,
        mcsInsuranceWithPp,
        mcsContentWithPp,
        mcsPackageMultipleBenefits,
      ];
  
      const topics = [
        process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_PP_PROFILE!,
        process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_PP_PROFILE_EXTRA!,
        process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_MASTER!,
      ];
  
      const ppmMessages: Message[] = Array.from(
        { length: numberOfMessages },
        (_, index) => ({
          key: `key-${index + 1}`,
          value: JSON.stringify(ppmProducts),
          headers: {
            ContentType: Buffer.from('application/json'),
            Version: Buffer.from('1.0'),
            Timestamp: Buffer.from(Date.now().toString()),
            test_custom_header: Buffer.from('none')
          }
        })
      );
  
      for (const topic of topics) {
        await this.producer.send({
          topic,
          messages: ppmMessages,
        });
        console.log(`PPM Messages sent successfully to ${topic}, number of messages: ${ppmMessages.length}`);
      }
  
  // src/kafka/services/kafka-client-test.ts
  
  // src/adapters/kafka-client-test.ts
  
  import { Kafka, KafkaConfig, logLevel, LogEntry, Admin } from "kafkajs";
  
  export class KafkaClientTest {
    private static instance: KafkaClientTest;
    admin: Admin;
    kafka: Kafka;
    logs: any[] = [];
  
    constructor(kafkaConfig: KafkaConfig) {
      const customLogCreator = () => {
        return ({ namespace, level, label, log }: LogEntry) => {
          const { message, ...rest } = log;
          this.logs.push({
            timestamp: new Date().toISOString(),
            namespace,
            level,
            label,
            message,
            details: rest
          });
        };
  
      const configWithLogging = {
        ...kafkaConfig,
        logLevel: logLevel.DEBUG,
        logCreator: customLogCreator,
      };
  
      this.kafka = new Kafka(configWithLogging);
      this.admin = this.kafka.admin();
      // console.log("KafkaClientTest initialized with config: ", JSON.stringify(kafkaConfig));
    }
  
    public static getInstance(kafkaConfig: KafkaConfig): KafkaClientTest {
      if (!KafkaClientTest.instance || kafkaConfig) {
        KafkaClientTest.instance = new KafkaClientTest(kafkaConfig);
      }
      return KafkaClientTest.instance;
    }
  
    public fetchLogs() {
      return this.logs;
    }
  
    public clearLogs() {
      this.logs = [];
    }
  
  
  // src/kafka/services/kafka-mcs-consumer.ts
  
  // src/adapters/kafka-mcs-consumer.adapter.ts
  
  import { Consumer, KafkaMessage } from "kafkajs";
  import { kafkaBaseClient } from "./kafka-client-base";
  import EtlClient from "../../external-apis/etl-client/services/etl-client";
  import { dynamoClient } from "../../shared-modules/dynamo/dynamo-client";
  import { retry, sleep } from "../../shared/helpers/retry.helper";
  import { formatMessage } from "../helpers/kafka-consumer.helper";
  import { KAFKA_MESSAGE_STATUSES } from "../constants/kafka.constant";
  import { AppLogger } from "../../shared-modules/logger/app-logger";
  import { Logger } from "../../interface/logger";
  import { KafkaConfigurations } from "../helpers/kafka-configurations.helper";
  
  class McsConsumerAdapter extends KafkaConfigurations {
    private static instance: McsConsumerAdapter;
    private consumer: Consumer = kafkaBaseClient.kafka.consumer({
      groupId: process.env.KAFKA_CONSUMER_MCS_GROUP!,
    });
    private etlClient: EtlClient = new EtlClient();
    private logger: AppLogger = new AppLogger();
    private groupId: string = process.env.KAFKA_CONSUMER_MCS_GROUP!;
    private messageBatch: any[] = [];
    private tableName: string = process.env.KAFKA_MESSAGES_TABLE!;
  
    // private readonly batchSize = 25;
    // private readonly messageValueSize = 10;
    // private readonly interBatchDelay = 1000;
    // private readonly maxAttempts = 5; // Maximum number of retry attempts
    // private readonly baseDelay = 1000; // Base delay in milliseconds
    // private readonly expFactor = 3; // Factor by which the delay will increase
  
    public static getInstance(): McsConsumerAdapter {
      if (!McsConsumerAdapter.instance) {
        McsConsumerAdapter.instance = new McsConsumerAdapter();
      }
      return McsConsumerAdapter.instance;
    }
  
    public async connectAndSubscribe(): Promise<void> {
      try {
        await this.loadConfigurations("mcs");
        if (!this.isEnable) {
          this.logger.warn("MCS: consumer status is disable.");
          return;
        }
  
        await this.consumer.connect();
        await Promise.all([
          this.consumer.subscribe({
            topic: process.env.KAFKA_MCS_TOPIC!,
            fromBeginning: true,
          }),
        ]);
        await this.run();
        this.logger.info(`MCS: Connected and subscribed successfully.`);
      } catch (error: any) {
        this.logger.error(`MCS: Failed to initialize.`, error);
        throw error;
      }
  
    private async run() {
      try {
        await this.consumer.run({
          eachBatch: async ({
            batch,
            resolveOffset,
            heartbeat,
            isRunning,
            isStale,
          }) => {
            if (!isRunning() || isStale()) {
              this.logger.info(`MCS: Consumer is not running or is stale, stopping processing.`);
              return;
            }
  
            const startBatchMessage: KafkaMessage = batch.messages[0];
            const endBatchMessage: KafkaMessage = batch.messages[batch.messages.length - 1];
            const startOffset = startBatchMessage?.offset;
            const endOffset = endBatchMessage?.offset;
  
            const transaction = this.logger.getInitialTransaction();
            await this.logger.createLog('MCS: New transaction initiated for new batch processing.', this.logger.constructLogBody(transaction));
  
            try {
              await this.processBatch(
                batch,
                resolveOffset,
                heartbeat,
                transaction,
              );
            } catch (error: any) {
              const updatedError = this.logger.constructError(error);
              await this.logger.createLog(`MCS: Error when calling eachBatch ${startOffset} and ${endOffset}`, this.logger.constructLogBody(
                transaction,
                { startOffset, endOffset },
                updatedError,
                null,
                "500",
                "UNSUCCESS",
                "Internal Server Error",
                `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
              ));
  
              throw error;
            }
          },
        });
      } catch (error: any) {
        this.logger.error("MCS: Failed during consumer run", error);
        throw error;
      }
  
    public async reconnect(): Promise<void> {
      try {
        await this.disconnect();
        await sleep(1000);
        await this.connectAndSubscribe();
        this.logger.info('MCS: Consumer reconnected and subscribed successfully.');
      } catch (error: any) {
        this.logger.error('MCS: Failed to reconnect.', error);
        throw error;
      }
  
    public async disconnect(): Promise<void> {
      try {
        await this.consumer.disconnect();
        this.logger.info(`MCS: Disconnected successfully.`);
      } catch (error: any) {
        this.logger.error(`MCS: Failed to disconnect.`, error);
        throw error;
      }
  
    private async processBatch(
      batch: any,
      resolveOffset: any,
      heartbeat: any,
      transaction: Partial<Logger>,
    ) {
      try {
        for (let message of batch.messages) {
          const formattedMessage = formatMessage(
            this.groupId,
            batch.topic,
            batch.partition,
            message
          );
          this.messageBatch.push(formattedMessage);
        }
      } catch (error) {
        throw error;
      }
  
      await this.logger.createLog(
        `MCS: Formatted ${this.messageBatch.length} messages successfully. Ready for slicing.`,
        this.logger.constructLogBody(transaction, this.messageBatch)
      );
  
      try {
        // Continuously process batches until all messages are handled
        while (this.messageBatch.length > 0) {
          await this.handleBatch(transaction, resolveOffset, heartbeat);
          await sleep(this.interBatchDelay);
        }
      } catch (error) {
        throw error;
      }
  
    private async handleBatch(transaction: Partial<Logger>, resolveOffset: any, heartbeat: any) {
      if (this.messageBatch.length === 0) return;
  
      const batchToProcess = this.messageBatch.slice(
        0,
        Math.min(this.messageBatch.length, this.batchSize)
      );
      const startBatchToProcess = batchToProcess[0];
      const lastBatchToProcess = batchToProcess[batchToProcess.length - 1];
      const remainingBatch = this.messageBatch.slice(batchToProcess.length);
      await this.logger.createLog('MCS: batchToProcess[0]', this.logger.constructLogBody(transaction, batchToProcess[0]));
  
      try {
        // Write to DynamoDB and process each message
        const writeSuccess = await this.writeMessagesToDynamoDB(batchToProcess);
        if (!writeSuccess) {
          await this.logger.createLog(
            `MCS: Failed to write batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        await this.processMessages(batchToProcess);
  
        // Update messages as sent in DynamoDB
        const updateSuccess = await this.updateMessageStatus(batchToProcess);
        if (!updateSuccess) {
          await this.logger.createLog(
            `MCS: Failed to update batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        resolveOffset(lastBatchToProcess.offset);
        await heartbeat();
  
        await this.logger.createLog(`MCS: Batch processing completed. Processed ${batchToProcess.length} messages.`, this.logger.constructLogBody(transaction, batchToProcess));
        await this.logger.createLog(`MCS: Remaining messages after current batch. ${remainingBatch.length} messages remain unprocessed.`, this.logger.constructLogBody(transaction, remainingBatch));
        await this.logger.createLog(`MCS: Resolved last offset at ${lastBatchToProcess.offset} for the batch.`, this.logger.constructLogBody(transaction, lastBatchToProcess.offset));
  
        this.messageBatch = remainingBatch;
        return;
      } catch (error) {
        throw error;
      }
  
    private async writeMessagesToDynamoDB(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchWriteItem(this.tableName, batchToProcess),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    private async processMessages(batchToProcess: any[]) {
      let accumulatedProducts: any[] = [];
      let headers: Record<string, string> = {};
  
      for (const msg of batchToProcess) {
        // Normalize message_value to an array, even if it's a single object
        const messageProducts = Array.isArray(msg.message_value) ? msg.message_value : [msg.message_value];
        accumulatedProducts = accumulatedProducts.concat(messageProducts);
  
        Object.keys(msg.headers).forEach(key => {
          headers[key] = msg.headers[key];
        });
  
        // Process in full batches
        while (accumulatedProducts.length >= this.messageValueSize) {
          const productsToSend = accumulatedProducts.slice(0, this.messageValueSize);
          await this.processProductBatch(productsToSend, headers);
          accumulatedProducts = accumulatedProducts.slice(this.messageValueSize);
        }
  
      // Process any remaining products
      await this.processProductBatch(accumulatedProducts, headers);
    }
  
    private async processProductBatch(products: any[], headers: Record<string, string>) {
      if (products.length > 0) {
        const workflowBody = this.etlClient.getMcsCreateProductBody(products);
        await this.etlClient.startWorkflow(workflowBody, headers);
      }
  
    private async updateMessageStatus(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchUpdateItems(
          this.tableName,
          batchToProcess.map(msg => ({ message_id: msg.message_id, status: KAFKA_MESSAGE_STATUSES.SENT })),
          KAFKA_MESSAGE_STATUSES.SENT,
          'message_id'
        ),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    public async checkConsumerHealth() {
      try {
        const describeGroup = await this.consumer.describeGroup();
        return {
          groupIds: [this.groupId],
          isConnected: describeGroup ? true : false,
          describeGroup,
        };
      } catch (error: any) {
        this.logger.error("MCS: Failed to check consumer health", error);
        return {
          groupIds: [this.groupId],
          isConnected: false,
        };
      }
  
  export const mcsConsumerAdapter = McsConsumerAdapter.getInstance();
  
  
  // src/kafka/services/kafka-moi-consumer.ts
  
  // src/adapters/kafka-moi-consumer.adapter.ts
  
  import { Consumer, KafkaMessage } from "kafkajs";
  import { kafkaBaseClient } from "./kafka-client-base";
  import EtlClient from "../../external-apis/etl-client/services/etl-client";
  import { dynamoClient } from "../../shared-modules/dynamo/dynamo-client";
  import { retry, sleep } from "../../shared/helpers/retry.helper";
  import { formatMessage } from "../helpers/kafka-consumer.helper";
  import { KAFKA_MESSAGE_STATUSES } from "../constants/kafka.constant";
  import { AppLogger } from "../../shared-modules/logger/app-logger";
  import { Logger } from "../../interface/logger";
  import { KafkaConfigurations } from "../helpers/kafka-configurations.helper";
  
  class MoiConsumerAdapter extends KafkaConfigurations {
    private static instance: MoiConsumerAdapter;
    private consumer: Consumer = kafkaBaseClient.kafka.consumer({
        groupId: process.env.KAFKA_CONSUMER_MOI_GROUP!,
      });
    private etlClient: EtlClient = new EtlClient();
    private logger: AppLogger = new AppLogger();
    private groupId: string = process.env.KAFKA_CONSUMER_MOI_GROUP!;
    private messageBatch: any[] = [];
    private tableName: string = process.env.KAFKA_MESSAGES_TABLE!;
    
    // private readonly batchSize = 25;
    // private readonly messageValueSize = 10;
    // private readonly interBatchDelay = 1000;
    // private readonly maxAttempts = 5; // Maximum number of retry attempts
    // private readonly baseDelay = 1000; // Base delay in milliseconds
    // private readonly expFactor = 3; // Factor by which the delay will increase
  
    // constructor() {
    //   this.groupId = process.env.KAFKA_CONSUMER_MOI_GROUP!;
    //   this.consumer = kafkaBaseClient.kafka.consumer({
    //     groupId: this.groupId,
    //   });
    //   this.etlClient = new EtlClient();
    //   this.logger = new AppLogger()
    // }
  
    public static getInstance(): MoiConsumerAdapter {
      if (!MoiConsumerAdapter.instance) {
        MoiConsumerAdapter.instance = new MoiConsumerAdapter();
      }
      return MoiConsumerAdapter.instance;
    }
  
    public async connectAndSubscribe(): Promise<void> {
      try {
        await this.loadConfigurations("moi");
        if (!this.isEnable) {
          this.logger.warn("MOI: consumer status is disable.");
          return;
        }
  
        await this.consumer.connect();
        await Promise.all([
          this.consumer.subscribe({
            topic: process.env.KAFKA_MOI_TOPIC!,
            fromBeginning: true,
          }),
        ]);
        await this.run();
        this.logger.info(`MOI: Connected and subscribed successfully.`);
      } catch (error: any) {
        this.logger.error(`MOI: Failed to initialize.`, error);
        throw error;
      }
  
    private async run() {
      try {
        await this.consumer.run({
          eachBatch: async ({
            batch,
            resolveOffset,
            heartbeat,
            isRunning,
            isStale,
          }) => {
            if (!isRunning() || isStale()) {
              this.logger.info(`MOI: Consumer is not running or is stale, stopping processing.`);
              return;
            }
  
            const startBatchMessage: KafkaMessage = batch.messages[0];
            const endBatchMessage: KafkaMessage = batch.messages[batch.messages.length - 1];
            const startOffset = startBatchMessage?.offset;
            const endOffset = endBatchMessage?.offset;
  
            const transaction = this.logger.getInitialTransaction();
            await this.logger.createLog('MOI: New transaction initiated for new batch processing.', this.logger.constructLogBody(transaction));
  
            try {
              await this.processBatch(
                batch,
                resolveOffset,
                heartbeat,
                transaction,
              );
            } catch (error: any) {
              const updatedError = this.logger.constructError(error);
              await this.logger.createLog(`MOI: Error when calling eachBatch ${startOffset} and ${endOffset}`, this.logger.constructLogBody(
                transaction,
                { startOffset, endOffset },
                updatedError,
                null,
                "500",
                "UNSUCCESS",
                "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
              ));
  
              throw error;
            }
          },
        });
      } catch (error: any) {
        this.logger.error("MOI: Failed during consumer run", error);
        throw error;
      }
  
    public async reconnect(): Promise<void> {
      try {
        await this.disconnect();
        await sleep(1000);
        await this.connectAndSubscribe();
        this.logger.info('MOI: Consumer reconnected and subscribed successfully.');
      } catch (error: any) {
        this.logger.error('MOI: Failed to reconnect.', error);
        throw error;
      }
  
    public async disconnect(): Promise<void> {
      try {
        await this.consumer.disconnect();
        this.logger.info(`MOI: Disconnected successfully.`);
      } catch (error: any) {
        this.logger.error(`MOI: Failed to disconnect.`, error);
        throw error;
      }
  
    private async processBatch(
      batch: any,
      resolveOffset: any,
      heartbeat: any,
      transaction: Partial<Logger>,
    ) {
      try {
        for (let message of batch.messages) {
          const formattedMessage = formatMessage(
            this.groupId,
            batch.topic,
            batch.partition,
            message
          );
          this.messageBatch.push(formattedMessage);
        }
      } catch (error) {
        throw error;
      }
  
      await this.logger.createLog(
        `MOI: Formatted ${this.messageBatch.length} messages successfully. Ready for slicing.`,
        this.logger.constructLogBody(transaction, this.messageBatch)
      );
  
      try {
        // Continuously process batches until all messages are handled
        while (this.messageBatch.length > 0) {
          await this.handleBatch(transaction, resolveOffset, heartbeat);
          console.log("transaction: " ,transaction);
          await sleep(this.interBatchDelay);
        }
      } catch (error) {
        throw error;
      }
  
    private async handleBatch(transaction: Partial<Logger>, resolveOffset: any, heartbeat: any) {
      if (this.messageBatch.length === 0) return;
  
      const batchToProcess = this.messageBatch.slice(
        0,
        Math.min(this.messageBatch.length, this.batchSize)
      );
      const startBatchToProcess = batchToProcess[0];
      const lastBatchToProcess = batchToProcess[batchToProcess.length - 1];
      const remainingBatch = this.messageBatch.slice(batchToProcess.length);
      await this.logger.createLog('MOI: batchToProcess[0]', this.logger.constructLogBody(transaction, batchToProcess[0]));
  
      try {
        // Write to DynamoDB and process each message
        const writeSuccess = await this.writeMessagesToDynamoDB(batchToProcess);
        if (!writeSuccess) {
          await this.logger.createLog(
            `MOI: Failed to write batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        await this.processMessages(batchToProcess);
  
        // Update messages as sent in DynamoDB
        const updateSuccess = await this.updateMessageStatus(batchToProcess);
        if (!updateSuccess) {
          await this.logger.createLog(
            `MOI: Failed to update batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        resolveOffset(lastBatchToProcess.offset);
        await heartbeat();
  
        await this.logger.createLog(`MOI: Batch processing completed. Processed ${batchToProcess.length} messages.`, this.logger.constructLogBody(transaction, batchToProcess));
        await this.logger.createLog(`MOI: Remaining messages after current batch. ${remainingBatch.length} messages remain unprocessed.`, this.logger.constructLogBody(transaction, remainingBatch));
        await this.logger.createLog(`MOI: Resolved last offset at ${lastBatchToProcess.offset} for the batch.`, this.logger.constructLogBody(transaction, lastBatchToProcess.offset));
  
        this.messageBatch = remainingBatch;
        return;
      } catch (error) {
        throw error;
      }
  
    private async writeMessagesToDynamoDB(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchWriteItem(this.tableName, batchToProcess),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    private async processMessages(batchToProcess: any[]) {
      let accumulatedProducts: any[] = [];
      let headers: Record<string, string> = {};
  
      for (const msg of batchToProcess) {
        // Normalize message_value to an array, even if it's a single object
        const messageProducts = Array.isArray(msg.message_value) ? msg.message_value : [msg.message_value];
        accumulatedProducts = accumulatedProducts.concat(messageProducts);
  
        Object.keys(msg.headers).forEach(key => {
          headers[key] = msg.headers[key];
        });
  
        // Process in full batches
        while (accumulatedProducts.length >= this.messageValueSize) {
          const productsToSend = accumulatedProducts.slice(0, this.messageValueSize);
          await this.processProductBatch(productsToSend, headers);
          accumulatedProducts = accumulatedProducts.slice(this.messageValueSize);
        }
  
      // Process any remaining products
      await this.processProductBatch(accumulatedProducts, headers);
    }
  
    private async processProductBatch(products: any[], headers: Record<string, string>) {
      if (products.length > 0) {
        const workflowBody = this.etlClient.getMoiCreateProductBody(products);
        await this.etlClient.startWorkflow(workflowBody, headers);
      }
  
    private async updateMessageStatus(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchUpdateItems(
          this.tableName,
          batchToProcess.map(msg => ({ message_id: msg.message_id, status: KAFKA_MESSAGE_STATUSES.SENT })),
          KAFKA_MESSAGE_STATUSES.SENT,
          'message_id'
        ),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    public async checkConsumerHealth() {
      try {
        const describeGroup = await this.consumer.describeGroup();
        return {
          groupIds: [this.groupId],
          isConnected: describeGroup ? true : false,
          describeGroup,
        };
      } catch (error: any) {
        this.logger.error("MOI: Failed to check consumer health", error);
        return {
          groupIds: [this.groupId],
          isConnected: false,
        };
      }
  
  export const moiConsumerAdapter = MoiConsumerAdapter.getInstance();
  
  
  // src/kafka/services/kafka-monitoring.service.ts
  
  import { kafkaBaseClient } from "./kafka-client-base";
  
  class KafkaMonitoringService {
    private static instance: KafkaMonitoringService;
    private topics: string[];
  
    constructor() {
      this.topics = [process.env.KAFKA_CONSUMER_MOI_GROUP!];
    }
  
    public static getInstance(): KafkaMonitoringService {
      if (!this.instance) {
        this.instance = new KafkaMonitoringService();
      }
      return this.instance;
    }
  
    async getConsumerOffsets(groupId: string, topics: string[]) {
      await kafkaBaseClient.admin.connect();
      try {
        const consumerOffsets = await kafkaBaseClient.admin.fetchOffsets({
          groupId,
          topics,
        });
        console.log("consumerOffsets", consumerOffsets);
  
        return consumerOffsets;
      } catch (error) {
        console.error("Failed to fetch offsets:", error);
        throw error;
      } finally {
        await kafkaBaseClient.admin.disconnect();
      }
  
  export const kafkaMonitoringService = KafkaMonitoringService.getInstance();
  
  
  // src/kafka/services/kafka-ppm-consumer.ts
  
  // src/adapters/kafka-ppm-consumer.adapter.ts
  
  import { Consumer, KafkaMessage } from "kafkajs";
  import { kafkaBaseClient } from "./kafka-client-base";
  import EtlClient from "../../external-apis/etl-client/services/etl-client";
  import { dynamoClient } from "../../shared-modules/dynamo/dynamo-client";
  import { retry, sleep } from "../../shared/helpers/retry.helper";
  import { formatMessage } from "../helpers/kafka-consumer.helper";
  import { KAFKA_MESSAGE_STATUSES } from "../constants/kafka.constant";
  import { AppLogger } from "../../shared-modules/logger/app-logger";
  import { Logger } from "../../interface/logger";
  import { KafkaConfigurations } from "../helpers/kafka-configurations.helper";
  
  class PpmConsumerAdapter extends KafkaConfigurations {
    private static instance: PpmConsumerAdapter;
    private consumer: Consumer = kafkaBaseClient.kafka.consumer({
      groupId: process.env.KAFKA_CONSUMER_PPM_GROUP!,
    });
    private etlClient: EtlClient = new EtlClient();
    private logger: AppLogger = new AppLogger();
    private groupId: string = process.env.KAFKA_CONSUMER_PPM_GROUP!;
    private messageBatch: any[] = [];
    private tableName: string = process.env.KAFKA_MESSAGES_TABLE!;
    
    // private readonly batchSize = 25;
    // private readonly messageValueSize = 10;
    // private readonly interBatchDelay = 1000;
    // private readonly maxAttempts = 5; // Maximum number of retry attempts
    // private readonly baseDelay = 1000; // Base delay in milliseconds
    // private readonly expFactor = 3; // Factor by which the delay will increase
  
    // constructor() {
    //   this.groupId = process.env.KAFKA_CONSUMER_PPM_GROUP!;
    //   this.consumer = kafkaBaseClient.kafka.consumer({
    //     groupId: this.groupId,
    //   });
    //   this.etlClient = new EtlClient();
    //   this.logger = new AppLogger()
    // }
  
    public static getInstance(): PpmConsumerAdapter {
      if (!PpmConsumerAdapter.instance) {
        PpmConsumerAdapter.instance = new PpmConsumerAdapter();
      }
      return PpmConsumerAdapter.instance;
    }
  
    public async connectAndSubscribe(): Promise<void> {
      try {
        await this.loadConfigurations("ppm");
        if (!this.isEnable) {
          this.logger.warn("MCS: consumer status is disable.");
          return;
        }
        
        await this.consumer.connect();
        await Promise.all([
          this.consumer.subscribe({
            topic: process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_PP_PROFILE!,
            fromBeginning: true,
          }),
          this.consumer.subscribe({
            topic: process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_PP_PROFILE_EXTRA!,
            fromBeginning: true,
          }),
          this.consumer.subscribe({
            topic: process.env.KAFKA_PPM_TOPIC_PREPAY_SYNC_MASTER!,
            fromBeginning: true,
          }),
        ]);
        await this.run();
        this.logger.info(`PPM: Connected and subscribed successfully.`);
      } catch (error: any) {
        this.logger.error(`PPM: Failed to initialize.`, error);
        throw error;
      }
  
    private async run() {
      try {
        await this.consumer.run({
          eachBatch: async ({
            batch,
            resolveOffset,
            heartbeat,
            isRunning,
            isStale,
          }) => {
            if (!isRunning() || isStale()) {
              this.logger.info(`PPM: Consumer is not running or is stale, stopping processing.`);
              return;
            }
  
            const startBatchMessage: KafkaMessage = batch.messages[0];
            const endBatchMessage: KafkaMessage = batch.messages[batch.messages.length - 1];
            const startOffset = startBatchMessage?.offset;
            const endOffset = endBatchMessage?.offset;
  
            const transaction = this.logger.getInitialTransaction();
            await this.logger.createLog('PPM: New transaction initiated for new batch processing.', this.logger.constructLogBody(transaction));
  
            try {
              await this.processBatch(
                batch,
                resolveOffset,
                heartbeat,
                transaction,
              );
            } catch (error: any) {
              const updatedError = this.logger.constructError(error);
              await this.logger.createLog(`PPM: Error when calling eachBatch ${startOffset} and ${endOffset}`, this.logger.constructLogBody(
                transaction,
                { startOffset, endOffset },
                updatedError,
                null,
                "500",
                "UNSUCCESS",
                "Internal Server Error",
                `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
              ));
  
              throw error;
            }
          },
        });
      } catch (error: any) {
        this.logger.error("PPM: Failed during consumer run", error);
        throw error;
      }
  
    public async reconnect(): Promise<void> {
      try {
        await this.disconnect();
        await sleep(1000);
        await this.connectAndSubscribe();
        this.logger.info('PPM: Consumer reconnected and subscribed successfully.');
      } catch (error: any) {
        this.logger.error('PPM: Failed to reconnect.', error);
        throw error;
      }
  
    public async disconnect(): Promise<void> {
      try {
        await this.consumer.disconnect();
        this.logger.info(`PPM: Disconnected successfully.`);
      } catch (error: any) {
        this.logger.error(`PPM: Failed to disconnect.`, error);
        throw error;
      }
  
    private async processBatch(
      batch: any,
      resolveOffset: any,
      heartbeat: any,
      transaction: Partial<Logger>,
    ) {
      try {
        for (let message of batch.messages) {
          const formattedMessage = formatMessage(
            this.groupId,
            batch.topic,
            batch.partition,
            message
          );
          this.messageBatch.push(formattedMessage);
        }
      } catch (error) {
        throw error;
      }
  
      await this.logger.createLog(
        `PPM: Formatted ${this.messageBatch.length} messages successfully. Ready for slicing.`,
        this.logger.constructLogBody(transaction, this.messageBatch)
      );
  
      try {
        // Continuously process batches until all messages are handled
        while (this.messageBatch.length > 0) {
          await this.handleBatch(transaction, resolveOffset, heartbeat);
          await sleep(this.interBatchDelay);
        }
      } catch (error) {
        throw error;
      }
  
    private async handleBatch(transaction: Partial<Logger>, resolveOffset: any, heartbeat: any) {
      if (this.messageBatch.length === 0) return;
  
      const batchToProcess = this.messageBatch.slice(
        0,
        Math.min(this.messageBatch.length, this.batchSize)
      );
      const startBatchToProcess = batchToProcess[0];
      const lastBatchToProcess = batchToProcess[batchToProcess.length - 1];
      const remainingBatch = this.messageBatch.slice(batchToProcess.length);
      await this.logger.createLog('PPM: batchToProcess[0]', this.logger.constructLogBody(transaction, batchToProcess[0]));
  
      try {
        // Write to DynamoDB and process each message
        const writeSuccess = await this.writeMessagesToDynamoDB(batchToProcess);
        if (!writeSuccess) {
          await this.logger.createLog(
            `PPM: Failed to write batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        await this.processMessages(batchToProcess);
  
        // Update messages as sent in DynamoDB
        const updateSuccess = await this.updateMessageStatus(batchToProcess);
        if (!updateSuccess) {
          await this.logger.createLog(
            `PPM: Failed to update batch after retries between offset ${startBatchToProcess.offset} and ${lastBatchToProcess.offset}.`,
            this.logger.constructLogBody(
              transaction,
              batchToProcess,
              null,
              "500",
              "UNSUCCESS",
              "Internal Server Error",
              `${process.env.AWS_REGION}:kafka-message-table:${process.env.KAFKA_MESSAGES_TABLE}`
            )
          );
          return;
        }
  
        resolveOffset(lastBatchToProcess.offset);
        await heartbeat();
  
        await this.logger.createLog(`PPM: Batch processing completed. Processed ${batchToProcess.length} messages.`, this.logger.constructLogBody(transaction, batchToProcess));
        await this.logger.createLog(`PPM: Remaining messages after current batch. ${remainingBatch.length} messages remain unprocessed.`, this.logger.constructLogBody(transaction, remainingBatch));
        await this.logger.createLog(`PPM: Resolved last offset at ${lastBatchToProcess.offset} for the batch.`, this.logger.constructLogBody(transaction, lastBatchToProcess.offset));
  
        this.messageBatch = remainingBatch;
        return;
      } catch (error) {
        throw error;
      }
  
    private async writeMessagesToDynamoDB(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchWriteItem(this.tableName, batchToProcess),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    private async processMessages(batchToProcess: any[]) {
      let accumulatedProducts: any[] = [];
      let headers: Record<string, string> = {};
  
      for (const msg of batchToProcess) {
        // Normalize message_value to an array, even if it's a single object
        const messageProducts = Array.isArray(msg.message_value) ? msg.message_value : [msg.message_value];
        accumulatedProducts = accumulatedProducts.concat(messageProducts);
  
        Object.keys(msg.headers).forEach(key => {
          headers[key] = msg.headers[key];
        });
  
        // Process in full batches
        while (accumulatedProducts.length >= this.messageValueSize) {
          const productsToSend = accumulatedProducts.slice(0, this.messageValueSize);
          await this.processProductBatch(productsToSend, headers);
          accumulatedProducts = accumulatedProducts.slice(this.messageValueSize);
        }
  
      // Process any remaining products
      await this.processProductBatch(accumulatedProducts, headers);
    }
  
    private async processProductBatch(products: any[], headers: Record<string, string>) {
      if (products.length > 0) {
        const workflowBody = this.etlClient.getPpmCreateProductBody(products);
        await this.etlClient.startWorkflow(workflowBody, headers);
      }
  
    private async updateMessageStatus(batchToProcess: any[]): Promise<boolean> {
      return await retry(
        async () => await dynamoClient.batchUpdateItems(
          this.tableName,
          batchToProcess.map(msg => ({ message_id: msg.message_id, status: KAFKA_MESSAGE_STATUSES.SENT })),
          KAFKA_MESSAGE_STATUSES.SENT,
          'message_id'
        ),
        this.maxAttempts,
        this.baseDelay,
        this.expFactor
      );
    }
  
    public async checkConsumerHealth() {
      try {
        const describeGroup = await this.consumer.describeGroup();
        return {
          groupIds: [this.groupId],
          isConnected: describeGroup ? true : false,
          describeGroup,
        };
      } catch (error: any) {
        this.logger.error("PPM: Failed to check consumer health", error);
        return {
          groupIds: [this.groupId],
          isConnected: false,
        };
      }
  
  export const ppmConsumerAdapter = PpmConsumerAdapter.getInstance();
  
  
  // src/kafka/tests/kafka-consumer.helper.spec.ts
  
  import { KAFKA_MESSAGE_STATUSES } from '../constants/kafka.constant';
  import { formatMessage } from '../helpers/kafka-consumer.helper';
  import { testGroupId, testTopic, testPartition, baseMessage, corruptMessage, messageWithNulls } from '../mocks/kafka.mock';
  import { moiProductInput } from '../mocks/moi.mock';
  
  describe('formatMessage', () => {
      it('should format message correctly with all properties', () => {
          const result = formatMessage(testGroupId, testTopic, testPartition, baseMessage);
          expect(result).toEqual(expect.objectContaining({
              groupId: testGroupId,
              topic: testTopic,
              partition: testPartition,
              offset: baseMessage.offset,
              message_key: 'key123',
              message_value: moiProductInput,
              headers: { header1: 'headerValue' },
              status: KAFKA_MESSAGE_STATUSES.PENDING,
              timestamp: baseMessage.timestamp,
          }));
          expect(result.message_id).toMatch(new RegExp(`^${testGroupId}-${testTopic}-${testPartition}-${baseMessage.offset}-\\d+$`));
          expect(result.producedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
          expect(result.receivedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
      });
  
      it('should handle JSON parsing errors', () => {
          const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
          const result = formatMessage(testGroupId, testTopic, testPartition, corruptMessage);
          expect(consoleSpy).toHaveBeenCalled();
          expect(result.message_value).toEqual({});
          consoleSpy.mockRestore();
      });
  
      it('should handle null key and value gracefully', () => {
          const result = formatMessage(testGroupId, testTopic, testPartition, messageWithNulls);
          expect(result.message_key).toBeNull();
          expect(result.message_value).toEqual({});
      });
  
  
  // src/not-found.route.ts
  
  import { NextFunction, Request, Response, Router } from "express";
  
  const router = Router();
  
  router.all("*", (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.status(404).send({
        message: "The requested resource was not found on this server.",
      });
    } catch (error) {
      return next(error);
    }
  });
  
  export default router;
  
  
  // src/shared/constants/app-envs.ts
  
  export const APP_ENVS = {
    PRODUCTION: "production",
    PRE_PROD: "pre-prod",
    STAGING: "staging",
    SANDBOX: "sandbox",
    LOCAL: "local",
  };
  
  
  // src/shared/constants/messages.ts
  
  export const EXCEPTION_MESSAGES = {
    SERVER_ERROR: `An unexpected error occurred. Please contact our support team, and we'll get this sorted for you as soon as possible!`,
    NOT_FOUND: 'The requested resource could not be found.',
    BAD_REQUEST: 'Invalid request.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'You do not have permission to access this resource.',
    CONFLICT: 'Data conflict. Please try again.',
    VALIDATION_ERROR: 'Validation failed.',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
    INTERNAL_SERVER_ERROR: 'Internal server error.',
    SERVICE_UNAVAILABLE: 'Service is currently unavailable.',
    TIMEOUT: 'Request timed out.',
  };
  
  export const RESPONSE_MESSAGES = {
    SUCCESS: 'Operation was successful.',
    CREATED: 'Resource has been created successfully.',
    UPDATED: 'Resource has been updated successfully.',
    DELETED: 'Resource has been deleted successfully.',
    SAVED: 'Data has been saved.',
    ACCEPTED: 'Request has been accepted for processing.',
    NO_CONTENT: 'Operation was successful but no content to return.',
    PARTIAL_CONTENT: 'Partial content returned.',
    NOT_MODIFIED: 'Resource has not been modified.',
    RESET_CONTENT: 'Reset content successfully.',
  };
  
  
  // src/shared/helpers/retry.helper.ts
  
  // src/helpers/retry.helper.ts
  
  /**
   * Generic retry logic for asynchronous operations.
   * @param fn - The function to retry which should return a promise.
   * @param maxAttempts - Maximum number of attempts.
   * @param baseDelay - Base delay in milliseconds for retries.
   * @param expFactor - Exponential factor to increase the delay.
   * @returns Promise that resolves to true if operation succeeds, false otherwise.
   */
  export async function retry<T>(fn: () => Promise<T>, maxAttempts: number, baseDelay: number, expFactor: number): Promise<boolean> {
      let attempts = 0;
      while (attempts < maxAttempts) {
          try {
              await fn();
              return true;
          } catch (error) {
              attempts++;
              if (attempts >= maxAttempts) {
                  console.error(`All ${maxAttempts} attempts failed:`, error);
                  return false;
              }
              const delay = baseDelay * Math.pow(expFactor, attempts);
              console.log(`Retrying in ${delay} ms... (${attempts}/${maxAttempts})`);
              await sleep(delay);
          }
      return false;
  }
  
  export function sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  
  // src/shared/middlewares/api-key.middleware.ts
  
  import { NextFunction, Request, Response, Router } from "express";
  
  export function apiKeyValidator(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const apiKey = req.headers["x-api-key"];
    const expectedApiKey = "Z3nj8S3pk38h6Pm8ulZceJQOe8kzvfOZ2TxSLCzUoFsKmjtKLm";
  
    if (!apiKey || apiKey !== expectedApiKey) {
      res.status(401).send({ error: "Unauthorized: Invalid API key" });
    }
  
    next();
  }
  
  
  // src/shared/middlewares/error-handler.middleware.ts
  
  // src/middlewares/error-handler.middleware.ts
  
  import { Request, Response, NextFunction } from "express";
  import { EXCEPTION_MESSAGES } from "../constants/messages";
  
  export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.error(err.stack);
    return res.status(500).send({ error: EXCEPTION_MESSAGES.SERVER_ERROR });
  };
  
  // src/shared/services/http-client-base.ts
  
  import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    AxiosError,
  } from "axios";
  import axiosRetry from "axios-retry";
  
  export class HttpClientBase {
    protected instance: AxiosInstance;
    private maxRetries: number;
    private retriableStatusCodes: number[];
  
    constructor(
      baseURL: string,
      timeout = 5000,
      maxRetries = 5,
      retriableStatusCodes = [408, 500, 502, 503, 504]
    ) {
      this.maxRetries = maxRetries;
      this.retriableStatusCodes = retriableStatusCodes;
  
      this.instance = axios.create({
        baseURL,
        headers: {
          "Content-Type": "application/json",
        },
        timeout,
      });
  
      this.initializeInterceptors();
    }
  
    private initializeInterceptors(): void {
      axiosRetry(this.instance, {
        retries: this.maxRetries,
        retryDelay: (retryCount) => {
          const delay = 1000 * Math.pow(2, retryCount);
          // console.log(`Retry #${retryCount} will occur after ${delay} ms.`);
          return delay;
        },
        retryCondition: (error: AxiosError) =>
          error.response
            ? this.retriableStatusCodes.includes(error.response.status)
            : true,
      });
  
      this.instance.interceptors.request.use(
        this.handleRequest,
        this.handleError
      );
  
      this.instance.interceptors.response.use(
        this.handleResponse,
        this.handleError
      );
    }
  
    protected handleRequest = (
      config: AxiosRequestConfig
    ): AxiosRequestConfig | any => {
      return config;
    };
  
    protected handleResponse = (response: AxiosResponse): AxiosResponse => {
      return response;
    };
  
    protected handleError = (error: AxiosError): Promise<never> => {
      // Start with basic error info
      // console.log(`Error Type: ${error.code || "No Code"}`);
      // console.log(`Error Message: ${error.message}`);
  
      // // Detailed error response if available
      // if (error.response) {
      //   console.log(`Response Status: ${error.response.status}`);
      //   console.log(`Response Data: ${JSON.stringify(error.response.data)}`);
      // } else {
      //   console.log("No HTTP response was received.");
      // }
  
      // // Timeout specific log
      // if (error.code === "ECONNABORTED" && error.message.includes("timeout")) {
      //   console.log("Timeout: Request timed out.");
      // }
  
      // // Check for network or connection errors
      // if (!error.response && error.request) {
      //   console.log(
      //     "Network Error: The request was made but no response was received"
      //   );
      // } else if (!error.response && !error.request) {
      //   console.log(
      //     "Request Setup Error: An error occurred setting up the request."
      //   );
      // }
  
      // Optionally, log the complete error object for deep debugging
      // console.log("Complete Error Object:", JSON.stringify(error, null, 2));
  
      return Promise.reject(error);
    };
  
    public async get(
      url: string,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
      return await this.instance.get(url, config);
    }
  
    public async post(
      url: string,
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
      return await this.instance.post(url, data, config);
    }
  
    public async put(
      url: string,
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
      return await this.instance.put(url, data, config);
    }
  
    public async delete(
      url: string,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
      return await this.instance.delete(url, config);
    }
  
    public async patch(
      url: string,
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
      return await this.instance.patch(url, data, config);
    }
  
  
  // src/shared-modules/dynamo/dynamo-client.ts
  
  import {
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput,
    PutItemCommandInput,
    PutItemCommand,
    UpdateItemCommand,
    ScanCommand,
    WriteRequest,
    BatchWriteItemCommandInput,
    BatchWriteItemCommand,
    ScanCommandInput,
    ScanCommandOutput,
    TransactWriteItemsCommand,
    QueryCommandOutput,
    QueryCommand,
    QueryCommandInput,
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import { retry } from "../../shared/helpers/retry.helper";
  
  export class dynamoDB {
    constructor(
      private readonly dynamoDBClient = new DynamoDBClient({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
    ) {}
  
    public async countAllItems(tableName: string): Promise<number> {
      let totalItems = 0;
      const scanParams: ScanCommandInput = {
        TableName: tableName,
        Select: "COUNT",
      };
  
      let scanResponse: ScanCommandOutput;
      do {
        scanResponse = await this.dynamoDBClient.send(
          new ScanCommand(scanParams)
        );
        totalItems += scanResponse.Count || 0;
        scanParams.ExclusiveStartKey = scanResponse.LastEvaluatedKey;
      } while (scanResponse.LastEvaluatedKey);
  
      return totalItems;
    }
  
    public async scanAllItems(
      tableName: string,
      limit = 100,
      groupId?: string,
      topic?: string,
      messageValueExists: boolean = false,
      headersExist: boolean = false
    ): Promise<any[]> {
      let items: any[] = [];
      const scanParams: ScanCommandInput = {
        TableName: tableName,
        Limit: limit,
        ExpressionAttributeValues: {},
        ExpressionAttributeNames: {},
      };
  
      let filterExpressions: string[] = [];
      if (groupId) {
        filterExpressions.push("#groupId = :groupId");
        scanParams.ExpressionAttributeNames!["#groupId"] = "groupId";
        scanParams.ExpressionAttributeValues![":groupId"] = { S: groupId };
      }
  
      if (topic) {
        filterExpressions.push("#topic = :topic");
        scanParams.ExpressionAttributeNames!["#topic"] = "topic";
        scanParams.ExpressionAttributeValues![":topic"] = { S: topic };
      }
  
      // Combine all filters into a single filter expression
      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(" AND ");
      }
  
      // Handle empty ExpressionAttributeValues and ExpressionAttributeNames
      if (Object.keys(scanParams.ExpressionAttributeValues!).length === 0) {
        delete scanParams.ExpressionAttributeValues;
      }
  
      if (Object.keys(scanParams.ExpressionAttributeNames!).length === 0) {
        delete scanParams.ExpressionAttributeNames;
      }
  
      let scanResponse;
      do {
        scanResponse = await this.dynamoDBClient.send(
          new ScanCommand(scanParams)
        );
        if (scanResponse.Items) {
          let filteredItems = scanResponse.Items.map((item) => unmarshall(item));
          if (messageValueExists) {
            filteredItems = filteredItems.filter(
              (item) => Object.keys(item.message_value).length > 0
            );
          }
          if (headersExist) {
            filteredItems = filteredItems.filter(
              (item) => Object.keys(item.headers).length > 0
            );
          }
          items = items.concat(filteredItems);
        }
        scanParams.ExclusiveStartKey = scanResponse.LastEvaluatedKey;
      } while (scanResponse.LastEvaluatedKey);
  
      return items;
    }
  
    public async deleteAllItems(
      tableName: string,
      primaryKey: string,
      sortKey?: string
    ): Promise<void> {
      try {
        const scanParams: ScanCommandInput = {
          TableName: tableName,
          ProjectionExpression: primaryKey + (sortKey ? `, ${sortKey}` : ""),
        };
        let scanResponse;
        do {
          scanResponse = await this.dynamoDBClient.send(
            new ScanCommand(scanParams)
          );
          const items = scanResponse.Items;
  
          if (items && items.length > 0) {
            for (let i = 0; i < items.length; i += 25) {
              const slice = items.slice(i, i + 25);
              const deleteRequests = slice.map((item) => ({
                DeleteRequest: {
                  Key: marshall({
                    [primaryKey]: item[primaryKey].S,
                    ...(sortKey && { [sortKey]: item[sortKey].S }),
                  }),
                },
              }));
  
              const successful = await retry(
                async () => {
                  await this.dynamoDBClient.send(
                    new BatchWriteItemCommand({
                      RequestItems: {
                        [tableName]: deleteRequests,
                      },
                    })
                  );
                },
                5,
                1000,
                3
              );
  
              if (!successful) {
                console.error("Failed to delete batch after retries");
                throw new Error("Failed to process batch delete");
              }
          scanParams.ExclusiveStartKey = scanResponse.LastEvaluatedKey;
        } while (scanResponse.LastEvaluatedKey);
      } catch (error) {
        console.error("Error deleting all items: ", error);
        throw new Error("Failed to delete all items from " + tableName);
      }
  
    /**
     * Batch write items to DynamoDB, handling up to 25 items at once (insert or overwrite).
     * @param tableName - The name of the DynamoDB table.
     * @param items - Array of items to write to DynamoDB.
     * @returns Promise resolving to the batch write response.
     */
    public async batchWriteItem(tableName: string, items: any[]): Promise<any> {
      const writeRequests: WriteRequest[] = items.map((item) => ({
        PutRequest: {
          Item: marshall(item),
        },
      }));
  
      const batchWriteItemInput: BatchWriteItemCommandInput = {
        RequestItems: {
          [tableName]: writeRequests,
        },
      };
  
      try {
        const command = new BatchWriteItemCommand(batchWriteItemInput);
        return await this.dynamoDBClient.send(command);
      } catch (error) {
        throw new Error("Failed to batch write items from " + tableName);
      }
  
    /**
     * Batch update items in DynamoDB, typically used for updating the status of items.
     * @param tableName - The name of the DynamoDB table.
     * @param items - Array of items whose status will be updated.
     * @param status - The new status to set for the items.
     * @param keyName - The name of the key attribute to use for the DynamoDB update.
     * @returns Promise resolving to the transaction write response.
     */
    public async batchUpdateItems(
      tableName: string,
      items: any[],
      status: string,
      keyName: string
    ): Promise<any> {
      const transactItems = items.map((item) => ({
        Update: {
          TableName: tableName,
          Key: marshall({ [keyName]: item[keyName] }), // Adjusted to remove undefined values
          UpdateExpression: "set #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: status }, // Specifying as a String attribute
          },
      }));
  
      try {
        const command = new TransactWriteItemsCommand({
          TransactItems: transactItems,
        });
        return await this.dynamoDBClient.send(command);
      } catch (error) {
        throw new Error(`Failed to update items in ${tableName}`);
      }
  
    public async findByKey(table: string = "", key: object): Promise<null | any> {
      try {
        if (!table) return null;
  
        const input: GetItemCommandInput = {
          TableName: table,
          Key: marshall(key),
        };
        const client = this.dynamoDBClient;
        const command = new GetItemCommand(input);
        const response = await client.send(command);
  
        if (!response?.Item) return null;
  
        return unmarshall(response?.Item);
      } catch (err) {
        console.log(err);
        return null;
      }
  
    public async putItem(
      table: string = "etl_workflow",
      data: any
    ): Promise<null | any> {
      try {
        const input: PutItemCommandInput = {
          TableName: table,
          ReturnConsumedCapacity: "TOTAL",
          Item: marshall(data),
        };
        const client = this.dynamoDBClient;
        const command = new PutItemCommand(input);
        const response = await client.send(command);
  
        if (!response?.Attributes) return null;
  
        return response?.ConsumedCapacity;
      } catch (err) {
        console.log(err);
        return null;
      }
  
    public async queryETLKafkaConfigurations<T>(
      tableName: string,
      service: string
    ): Promise<T[]> {
      try {
        const params: QueryCommandInput = {
          TableName: tableName,
          KeyConditionExpression: "#pk = :pkVal",
          ExpressionAttributeNames: { "#pk": "service" },
          ExpressionAttributeValues: {
            ":pkVal": { S: service },
          },
        };
  
        const command = new QueryCommand(params);
        const response: QueryCommandOutput = await this.dynamoDBClient.send(
          command
        );
  
        if (!response.Items) {
          return [] as T[];
        }
  
        // Unmarshall items
        const items = response.Items.map((item) => unmarshall(item));
        return items as T[];
      } catch (error) {
        console.error("Error querying:", error);
        return [] as T[];
      }
  
  export const dynamoClient = new dynamoDB();
  
  
  // src/shared-modules/logger/app-logger.ts
  
  import path from 'path';
  import fs from 'fs';
  import winston, { format } from 'winston';
  import DailyRotateFile from 'winston-daily-rotate-file';
  import { v4 as uuidv4 } from 'uuid'
  import { Logger } from '../../interface/logger';
  
  export type LogMessage = string;
  export type LogContext = object;
  export enum LogLevel {
      DEBUG = 'debug',
      INFO = 'info',
      WARN = 'warn',
      ERROR = 'error',
  }
  
  export class AppLogger {
      private _logger: winston.Logger;
      private static _logDirectory: string = path.join(process.cwd(), "logs");
      private static _appName = 'etl-kafka';
      private static _fileName = 'app';
      private loggerChild: any;
  
      constructor() {
          this._logger = this._initializeWinston();
          this.createLogFolderIfNotExists();
          this.loggerChild = this.child();
      }
  
      public static responseLogger(): Logger {
          return {
              request: {},
              response: {},
              result_code: '',
              result_indicator: '',
          }
  
      public profiler() {
          return this._logger.startTimer();
      }
  
      public child() {
          return this._logger.child(AppLogger.baseMeta());
      }
  
      public static baseMeta() {
          return { txid: uuidv4(), product: process.env?.PROJECT, channel: process.env?.PROJECT };
      }
  
      public info(msg: LogMessage, context?: LogContext) {
          this._log(msg, LogLevel.INFO, context);
      }
  
      public warn(msg: LogMessage, context?: LogContext) {
          this._log(msg, LogLevel.WARN, context);
      }
  
      public error(msg: LogMessage, context?: LogContext) {
          this._log(msg, LogLevel.ERROR, context);
      }
  
      public debug(msg: LogMessage, context?: LogContext) {
          if (process.env.NODE_ENV !== 'production') {
              this._log(msg, LogLevel.DEBUG, context); // Don't log debug in production
          }
  
      private _log(msg: LogMessage, level: LogLevel, context?: LogContext) {
          this._logger.log(level, msg, { context: context });
      }
  
      private _initializeWinston() {
          const logger = winston.createLogger({
              format: format.combine(
                  format.errors({ stack: true }),
                  format.timestamp({
                      format: 'YYYY-MM-DD HH:mm:ss'
                  }),
                  format.json(),
              ),
              transports: AppLogger._getTransports(),
              exitOnError: false,
              // exceptionHandlers: [
              //     new winston.transports.File({ 
              //         filename: 'exception.log',
              //         format: format.combine(
              //             format.timestamp(),
              //             format.json()
              //         )
              //     })
              // ],
              // rejectionHandlers: [
              //     new winston.transports.File({ 
              //         filename: 'rejections.log',
              //         format: format.combine(
              //             format.timestamp(),
              //             format.json()
              //         )
              //     })
              // ],
          });
          return logger;
      }
  
      private static _getTransports() {
          const transports: Array<any> = [
              new winston.transports.Console({
                  format: this._getFormatForConsole(),
              }),
          ];
  
          // if (process.env.NODE_ENV === 'production') {
          transports.push(this._getFileTransport()); // Also log file in production
          // }
  
          return transports;
      }
  
      private static _getFormatForConsole() {
          return format.combine(
              format.timestamp(),
              format.printf(
                  info =>
                      `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message
                      } [CONTEXT] -> ${info.context ? '\n' + JSON.stringify(info.context, null, 2) : '{}' // Including the context
                      }`
              ),
              format.colorize({ all: true })
          );
      }
  
      private static _getFileTransport() {
          const baseMeta = AppLogger.baseMeta()
          return new DailyRotateFile({
              filename: path.join(AppLogger._logDirectory, `${AppLogger._fileName}-%DATE%.log`),
              zippedArchive: true, // Compress gzip
              maxSize: '10m', // Rotate after 10MB
              maxFiles: '14d', // Only keep last 14 days
              format: format.combine(
                  format.timestamp(),
                  format(info => {
                      info.app = this._appName;
                      info.msg = info.message;
                      info.start_date = new Date(info.timestamp).toISOString();
                      info.channel = baseMeta?.channel;
                      info.product = baseMeta?.product;
                      info.channel = baseMeta?.channel;
                      if (typeof info.txid === 'undefined') info.txid = baseMeta?.txid
                      if (typeof info.step_txid === 'undefined') info.step_txid = uuidv4()
                      delete info.message
                      return info;
                  })(),
                  format.json()
              ),
          });
      }
  
      private createLogFolderIfNotExists() {
          if (!fs.existsSync(AppLogger._logDirectory)) fs.mkdirSync(AppLogger._logDirectory);
      }
  
      public getInitialTransaction(): Partial<Logger> {
          const txid = uuidv4();
          return { txid };
      }
  
      public constructError(error: any) {
          const { message, stack } = error;
          return {
              message: message,
              ...(stack ? { stack: stack } : {}),
          }
  
      public constructLogBody(transaction: Partial<Logger>, request?: any, response?: any, start_date?: string | null, step_txid?: string | null, result_code?: string, result_indicator?: string, result_desc?: string, endpoint?: string): Logger {
          const updatedTransaction = {
              ...transaction,
              txid: transaction.txid || uuidv4()
          };
  
          return {
              ...updatedTransaction,
              step_txid: step_txid || uuidv4(),
              request,
              response,
              start_date: start_date || new Date().toISOString(),
              result_code: result_code || '200',
              result_indicator: result_indicator || 'SUCCESS',
              result_desc: result_desc || 'OK',
              service_type: 'ETL',
              endpoint
          }
  
      public async createLog(msg: LogMessage, requestLog: Logger): Promise<void> {
          try {
              switch (requestLog.result_code) {
                  case "200":
                  case "201":
                  case "204":
                      this.loggerChild.info(msg, requestLog);
                      break;
                  case "400":
                  case "401":
                  case "403":
                  case "404":
                  case "429":
                  case "500":
                  case "501":
                  case "502":
                  case "503":
                      this.loggerChild.error(msg, requestLog);
                      break;
                  default:
                      // Handle unexpected status codes or cases where result_code might not be a standard HTTP status
                      this.loggerChild.warn(`Unhandled status code: ${requestLog.result_code}`, requestLog);
                      break;
              }
          } catch (error) {
              console.error("Logging error:", error);
          }
  
  // src/shared-modules/telnet/controllers/telnet.controller.ts
  
  // src/controllers/telnet-client.controller.ts
  
  import { Request, Response } from 'express';
  import { TelnetClientService } from "../services/telnet-client.service";
  import Joi from "joi";
  
  export class TelnetController {
      private telnetService: TelnetClientService;
  
      constructor() {
          this.telnetService = new TelnetClientService();
      }
  
      public async testConnection(req: Request, res: Response): Promise<void> {
          const schema = Joi.object({
              host: Joi.string().required(),
              port: Joi.number().port().required()
          });
  
          const { error, value } = schema.validate(req.body);
          if (error) {
              res.status(400).send(error.details[0].message);
              return;
          }
  
          const { host, port } = value;
  
          try {
              const result = await this.telnetService.testConnection(host, port);
              res.send(result);
          } catch (error: any) {
              res.status(500).send(`Error connecting to ${host}:${port}: ${error.message}`);
          }
  
  
  // src/shared-modules/telnet/routes/telnet.route.ts
  
  // src/routes/telnet.route.ts
  
  import { Router } from 'express';
  import { TelnetController } from '../controllers/telnet.controller';
  import { apiKeyValidator } from '../../../shared/middlewares/api-key.middleware';
  
  const router = Router();
  const telnetController = new TelnetController();
  
  router.post("/test-connection", apiKeyValidator, (req, res) => telnetController.testConnection(req, res));
  
  export default router;
  
  
  // src/shared-modules/telnet/schemas/test-connection.schema.ts
  
  import Joi from "joi";
  
  export const testConnectionSchema = Joi.object({
      host: Joi.string().required(),
      port: Joi.number().port().required()
  });
  
  // src/shared-modules/telnet/services/telnet-client.service.ts
  
  // src/services/telnet-client.service.ts
  
  import { TelnetClient } from "./telnet-client";
  
  export class TelnetClientService {
      private telnetClient: TelnetClient;
  
      constructor() {
          this.telnetClient = new TelnetClient();
      }
  
      public async testConnection(host: string, port: number): Promise<any> {
          try {
              await this.telnetClient.connect(host, port);
              this.telnetClient.disconnect();
              return { host, port, isConnected: true };
          } catch (error: any) {
              throw new Error(`Connection error: ${error.message}`);
          }
  
  
  // src/shared-modules/telnet/services/telnet-client.ts
  
  // src/adapters/telnet-client.ts
  
  import { Telnet } from "telnet-client";
  
  export class TelnetClient {
    private connection: Telnet;
  
    constructor() {
      this.connection = new Telnet();
    }
  
    async connect(host: string, port: number, shellPrompt: string = "/ # ", timeout: number = 5000): Promise<boolean> {
      const params = {
        host,
        port,
        shellPrompt,
        timeout,
        negotiationMandatory: false,
        ors: "\r\n",
        waitforTimeout: 5000,
      };
  
      try {
        console.log(`Attempting to connect with parameters:`, params);
        await this.connection.connect(params);
        console.log(`Successfully connected to ${host}:${port}`);
        return true;
      } catch (error: any) {
        console.error(`Failed to connect to ${host}:${port}. Error:`, error);
        return false;
      }
  
    disconnect(): void {
      this.connection.end();
      console.log("Disconnected Telnet connection");
    }
  
  
  // src/types/index.ts
  
  export type InternalServiceConfig = {
    mcs: Partial<InternalServiceValue>;
    moi: Partial<InternalServiceValue>;
    ppm: Partial<InternalServiceValue>;
  };
  
  export type InternalServiceValue = {
    isEnable: boolean;
  } & DefaultConfigurations;
  
  export type InternalServiceKey = keyof InternalServiceConfig;
  
  export type DefaultConfigurations = {
    baseDelay: number;
    batchSize: number;
    expFactor: number;
    interBatchDelay: number;
    maxAttempts: number;
    messageValueSize: number;
  };
  
  export type EtlKafkaConfigurations = DefaultConfigurations & {
    internalConfigs: Partial<InternalServiceConfig>;
  };
  
  export type ServiceConfig = {
    service: string;
    configs: EtlKafkaConfigurations;
  };
  
  
  