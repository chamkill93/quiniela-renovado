export type ProviderMode="MOCK"|"UAT"|"PROD";
export interface GamingProvider{getBalance(userId:string):Promise<bigint>;placeTraditionalBet(input:unknown):Promise<unknown>;placeInstantBet(input:unknown):Promise<unknown>;getResults(input?:unknown):Promise<unknown>;}
