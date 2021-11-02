export interface SendableMessageProperties {
	clientTags?: Map<string, string>;
	repliesToLabel?: string;
	partOfBatch?: string;
}
